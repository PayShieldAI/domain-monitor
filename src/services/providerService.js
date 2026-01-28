const TrueBizProvider = require('./providers/TrueBizProvider');
const domainRepository = require('../repositories/domainRepository');
const providerRepository = require('../repositories/providerRepository');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Provider Service
 * Manages multiple domain intelligence providers
 * Loads provider config from database on each request (no caching)
 */
const providerService = {
  /**
   * Create a provider instance from database config
   * @param {Object} providerConfig - Provider config from database
   * @returns {Object} Provider instance
   */
  createProviderInstance(providerConfig) {
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
        return null;
    }

    return provider;
  },

  /**
   * Get a provider by name (loads from DB)
   * @param {string} name - Provider name
   * @returns {Promise<Object>} Provider instance
   */
  async getProvider(name) {
    const providerConfig = await providerRepository.findByName(name);
    if (!providerConfig || !providerConfig.enabled) {
      return null;
    }
    return this.createProviderInstance(providerConfig);
  },

  /**
   * Get primary provider (loads from DB)
   * @returns {Promise<Object>} Provider instance
   */
  async getPrimaryProvider() {
    const dbProviders = await providerRepository.getAllEnabled();

    if (dbProviders.length === 0) {
      throw new AppError('No provider configured', 500, 'NO_PROVIDER');
    }

    // Find primary provider (lowest priority number)
    const primaryConfig = dbProviders.reduce((prev, curr) =>
      (prev.priority < curr.priority) ? prev : curr
    );

    const provider = this.createProviderInstance(primaryConfig);
    if (!provider) {
      throw new AppError('Failed to create provider instance', 500, 'PROVIDER_CREATE_FAILED');
    }

    return provider;
  },

  /**
   * Check a domain using primary provider with fallback
   * @param {string} domainId - Domain ID
   * @param {string|Object} domainOrPayload - Domain name string or full payload object with business info
   * @returns {Promise<Object>} Check result
   */
  async checkDomain(domainId, domainOrPayload) {
    // Validate domainId is provided
    if (!domainId) {
      logger.error({
        domainOrPayload: typeof domainOrPayload === 'string' ? domainOrPayload : domainOrPayload?.domain,
        hasPayload: !!domainOrPayload
      }, 'checkDomain called without domainId - this will result in missing domain_id in logs');
    }

    const provider = await this.getPrimaryProvider();

    try {
      const result = await provider.checkDomain(domainOrPayload, domainId);

      // Update domain with check result
      await domainRepository.updateWithCheckResult(domainId, result);

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
  },

  /**
   * Check multiple domains
   * @param {Array} domains - Array of {id, domain} objects
   * @returns {Promise<Array>} Results
   */
  async checkDomainsBatch(domains) {
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
  },

  /**
   * Start monitoring a domain with the primary provider
   * @param {string} domainId - Domain ID
   * @param {string} domainName - Domain name
   * @param {string} checkFrequency - Check frequency in days ('7', '30', '90')
   * @returns {Promise<Object>} Monitoring result
   */
  async startMonitoring(domainId, domainName, checkFrequency = '7') {
    // Validate domainId is provided
    if (!domainId) {
      logger.error({
        domainName,
        checkFrequency
      }, 'startMonitoring called without domainId - this will result in missing domain_id in logs');
    }

    const provider = await this.getPrimaryProvider();

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
  },

  /**
   * Stop monitoring a domain with the primary provider
   * @param {string} domainId - Domain ID
   * @param {string} domainName - Domain name
   * @returns {Promise<Object>} Stop monitoring result
   */
  async stopMonitoring(domainId, domainName) {
    // Validate domainId is provided
    if (!domainId) {
      logger.error({
        domainName
      }, 'stopMonitoring called without domainId - this will result in missing domain_id in logs');
    }

    const provider = await this.getPrimaryProvider();

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
  },

  /**
   * Check provider health
   * @param {string} providerName - Provider name (optional, checks all if not provided)
   * @returns {Promise<Object>} Health status
   */
  async checkProviderHealth(providerName) {
    if (providerName) {
      const provider = await this.getProvider(providerName);
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
    const dbProviders = await providerRepository.getAllEnabled();
    const statuses = {};

    for (const providerConfig of dbProviders) {
      const provider = this.createProviderInstance(providerConfig);
      if (provider) {
        statuses[providerConfig.name] = await provider.healthCheck();
      }
    }

    return statuses;
  }
};

module.exports = providerService;
