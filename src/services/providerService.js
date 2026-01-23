const TrueBizProvider = require('./providers/TrueBizProvider');
const domainRepository = require('../repositories/domainRepository');
const providerRepository = require('../repositories/providerRepository');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Provider Service
 * Manages multiple domain intelligence providers
 */
class ProviderService {
  constructor() {
    this.providers = new Map();
    this.primaryProvider = null;
    this.initialized = false;
  }

  /**
   * Initialize providers from database configuration
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load providers from database
      const dbProviders = await providerRepository.getAllEnabled();

      if (dbProviders.length === 0) {
        logger.warn('No providers configured in database');
        this.initialized = true;
        return;
      }

      // Initialize each provider
      for (const providerConfig of dbProviders) {
        try {
          const apiKey = decrypt(providerConfig.api_key_encrypted);
          // Parse config if it's a string, otherwise use as-is
          let config = {};
          if (providerConfig.config) {
            if (typeof providerConfig.config === 'string') {
              try {
                config = JSON.parse(providerConfig.config);
              } catch (e) {
                logger.warn({ provider: providerConfig.name }, 'Failed to parse provider config');
                config = {};
              }
            } else {
              config = providerConfig.config;
            }
          }

          // Log the config being passed to provider
          logger.info({
            providerName: providerConfig.name,
            apiBaseUrl: providerConfig.api_base_url,
            timeout: providerConfig.timeout,
            rateLimit: providerConfig.rate_limit,
            hasApiKey: !!apiKey,
            configKeys: Object.keys(config)
          }, 'Initializing provider with config');

          let provider;
          switch (providerConfig.name) {
            case 'truebiz':
              provider = new TrueBizProvider({
                apiKey,
                apiBaseUrl: providerConfig.api_base_url,
                timeout: providerConfig.timeout,
                rateLimit: providerConfig.rate_limit,
                ...config
              });
              break;
            default:
              logger.warn({ provider: providerConfig.name }, 'Unknown provider type');
              continue;
          }

          const isPrimary = providerConfig.priority === 10; // Lowest priority is primary
          this.registerProvider(providerConfig.name, provider, isPrimary);

        } catch (error) {
          logger.error({
            provider: providerConfig.name,
            error: error.message
          }, 'Failed to initialize provider');
        }
      }

      this.initialized = true;
      logger.info({ count: this.providers.size }, 'Provider service initialized');

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize providers');
      throw error;
    }
  }

  /**
   * Register a provider
   * @param {string} name - Provider name
   * @param {BaseProvider} provider - Provider instance
   * @param {boolean} isPrimary - Set as primary provider
   */
  registerProvider(name, provider, isPrimary = false) {
    this.providers.set(name, provider);

    if (isPrimary || !this.primaryProvider) {
      this.primaryProvider = provider;
      logger.info({ provider: name }, 'Primary provider set');
    }

    logger.info({ provider: name }, 'Provider registered');
  }

  /**
   * Get a provider by name
   * @param {string} name - Provider name
   * @returns {BaseProvider}
   */
  getProvider(name) {
    return this.providers.get(name);
  }

  /**
   * Get primary provider
   * @returns {BaseProvider}
   */
  getPrimaryProvider() {
    if (!this.primaryProvider) {
      throw new AppError('No provider configured', 500, 'NO_PROVIDER');
    }
    return this.primaryProvider;
  }

  /**
   * Check a domain using primary provider with fallback
   * @param {string} domainId - Domain ID
   * @param {string|Object} domainOrPayload - Domain name string or full payload object with business info
   * @returns {Promise<Object>} Check result
   */
  async checkDomain(domainId, domainOrPayload) {
    await this.ensureInitialized();

    // Validate domainId is provided
    if (!domainId) {
      logger.error({
        domainOrPayload: typeof domainOrPayload === 'string' ? domainOrPayload : domainOrPayload?.domain,
        hasPayload: !!domainOrPayload
      }, 'checkDomain called without domainId - this will result in missing domain_id in logs');
    }

    const provider = this.getPrimaryProvider();

    try {
      const result = await provider.checkDomain(domainOrPayload, domainId);

      // Update domain with check result
      await domainRepository.updateWithCheckResult(domainId, result);

      // Save check history
      await domainRepository.createCheckHistory({
        domainId,
        recommendation: result.recommendation,
        provider: result.provider,
        rawData: result.rawData
      });

      const domainName = typeof domainOrPayload === 'string' ? domainOrPayload : domainOrPayload.domain;
      logger.info({
        domainId,
        domain: domainName,
        provider: result.provider,
        recommendation: result.recommendation
      }, 'Domain check successful');

      return result;

    } catch (error) {
      const domainName = typeof domainOrPayload === 'string' ? domainOrPayload : domainOrPayload.domain;
      logger.error({
        domainId,
        domain: domainName,
        provider: provider.name,
        error: error.message
      }, 'Domain check failed');

      // TODO: Implement fallback to secondary providers
      throw error;
    }
  }

  /**
   * Check multiple domains
   * @param {Array} domains - Array of {id, domain} objects
   * @returns {Promise<Array>} Results
   */
  async checkDomainsBatch(domains) {
    await this.ensureInitialized();

    const results = [];

    for (const item of domains) {
      try {
        const result = await this.checkDomain(item.id, item.domain);
        results.push({
          domainId: item.id,
          domain: item.domain,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          domainId: item.id,
          domain: item.domain,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Start monitoring a domain with the primary provider
   * @param {string} domainId - Domain ID
   * @param {string} domainName - Domain name
   * @param {string} checkFrequency - Check frequency in days ('7', '30', '90')
   * @returns {Promise<Object>} Monitoring result
   */
  async startMonitoring(domainId, domainName, checkFrequency = '7') {
    await this.ensureInitialized();

    // Validate domainId is provided
    if (!domainId) {
      logger.error({
        domainName,
        checkFrequency
      }, 'startMonitoring called without domainId - this will result in missing domain_id in logs');
    }

    const provider = this.getPrimaryProvider();

    // Check if provider supports monitoring
    if (typeof provider.startMonitoring !== 'function') {
      logger.warn({
        provider: provider.name,
        domain: domainName
      }, 'Provider does not support monitoring');
      return null;
    }

    try {
      const result = await provider.startMonitoring(domainName, domainId, domainId, checkFrequency);

      logger.info({
        domainId,
        domain: domainName,
        provider: provider.name
      }, 'Domain monitoring started');

      return result;

    } catch (error) {
      logger.error({
        domainId,
        domain: domainName,
        provider: provider.name,
        error: error.message
      }, 'Failed to start domain monitoring');

      // Don't throw - monitoring failure shouldn't fail domain creation
      return null;
    }
  }

  /**
   * Stop monitoring a domain with the primary provider
   * @param {string} domainId - Domain ID
   * @param {string} domainName - Domain name
   * @returns {Promise<Object>} Stop monitoring result
   */
  async stopMonitoring(domainId, domainName) {
    await this.ensureInitialized();

    // Validate domainId is provided
    if (!domainId) {
      logger.error({
        domainName
      }, 'stopMonitoring called without domainId - this will result in missing domain_id in logs');
    }

    const provider = this.getPrimaryProvider();

    // Check if provider supports stop monitoring
    if (typeof provider.stopMonitoring !== 'function') {
      logger.warn({
        provider: provider.name,
        domain: domainName
      }, 'Provider does not support stop monitoring');
      return null;
    }

    try {
      const result = await provider.stopMonitoring(domainName, domainId);

      logger.info({
        domainId,
        domain: domainName,
        provider: provider.name
      }, 'Domain monitoring stopped with provider');

      return result;

    } catch (error) {
      logger.error({
        domainId,
        domain: domainName,
        provider: provider.name,
        error: error.message
      }, 'Failed to stop domain monitoring with provider');

      // Don't throw - stop monitoring failure shouldn't fail the operation
      return null;
    }
  }

  /**
   * Check provider health
   * @param {string} providerName - Provider name (optional, checks all if not provided)
   * @returns {Promise<Object>} Health status
   */
  async checkProviderHealth(providerName) {
    await this.ensureInitialized();

    if (providerName) {
      const provider = this.getProvider(providerName);
      if (!provider) {
        throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
      }

      const isHealthy = await provider.healthCheck();
      return {
        provider: providerName,
        healthy: isHealthy
      };
    }

    // Check all providers
    const statuses = {};
    for (const [name, provider] of this.providers.entries()) {
      statuses[name] = await provider.healthCheck();
    }

    return statuses;
  }

  /**
   * Ensure providers are initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Export singleton instance
module.exports = new ProviderService();
