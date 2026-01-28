const providerRepository = require('../repositories/providerRepository');
const providerService = require('./providerService');
const { encrypt } = require('../utils/encryption');
const { query } = require('../config/database');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Provider Admin Service
 * Manages provider configuration (admin operations)
 */
const providerAdminService = {
  /**
   * List all providers (enabled and disabled)
   */
  async listProviders() {
    const sql = 'SELECT * FROM providers ORDER BY priority ASC, created_at ASC';
    const providers = await query(sql);

    // Mask API keys for security
    return providers.map(p => this.formatProvider(p));
  },

  /**
   * Get provider by ID
   */
  async getProviderById(id) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }
    return this.formatProvider(provider);
  },

  /**
   * Get provider by name
   */
  async getProviderByName(name) {
    const provider = await providerRepository.findByName(name);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }
    return this.formatProvider(provider);
  },

  /**
   * Create new provider
   */
  async createProvider({ name, displayName, apiBaseUrl, apiKey, enabled = true, priority = 100, rateLimit = 60, timeout = 10000, config = {} }) {
    // Check if provider already exists
    const existing = await providerRepository.findByName(name);
    if (existing) {
      throw new AppError('Provider already exists', 409, 'PROVIDER_EXISTS');
    }

    // Encrypt API key
    const apiKeyEncrypted = encrypt(apiKey);

    // Create provider
    const provider = await providerRepository.upsert({
      name,
      displayName,
      apiBaseUrl,
      apiKeyEncrypted,
      enabled,
      priority,
      rateLimit,
      timeout,
      config
    });

    if (!provider) {
      throw new AppError('Provider creation failed', 500, 'PROVIDER_CREATE_FAILED');
    }

    logger.info({ providerId: provider.id, name: provider.name }, 'Provider created');

    // Reload provider service to pick up new provider
    await this.reloadProviders();

    return this.formatProvider(provider);
  },

  /**
   * Update existing provider (partial update - only updates provided fields)
   */
  async updateProvider(id, updates) {
    const existing = await providerRepository.findById(id);
    if (!existing) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    const fieldsToUpdate = {};

    // If updating API key, encrypt it
    if (updates.apiKey) {
      fieldsToUpdate.apiKeyEncrypted = encrypt(updates.apiKey);
    }

    // If updating webhook secret, encrypt it
    if (updates.webhookSecret) {
      fieldsToUpdate.webhookSecretEncrypted = encrypt(updates.webhookSecret);
    }

    // If updating name, check for conflicts
    if (updates.name && updates.name !== existing.name) {
      const conflict = await providerRepository.findByName(updates.name);
      if (conflict) {
        throw new AppError('Provider name already exists', 409, 'PROVIDER_NAME_CONFLICT');
      }
      fieldsToUpdate.name = updates.name;
    }

    // Parse config if provided as string
    if (updates.config !== undefined) {
      if (typeof updates.config === 'string') {
        fieldsToUpdate.config = JSON.parse(updates.config);
      } else {
        fieldsToUpdate.config = updates.config;
      }
    }

    // Add other fields if provided
    if (updates.displayName !== undefined) fieldsToUpdate.displayName = updates.displayName;
    if (updates.apiBaseUrl !== undefined) fieldsToUpdate.apiBaseUrl = updates.apiBaseUrl;
    if (updates.enabled !== undefined) fieldsToUpdate.enabled = updates.enabled;
    if (updates.priority !== undefined) fieldsToUpdate.priority = updates.priority;
    if (updates.rateLimit !== undefined) fieldsToUpdate.rateLimit = updates.rateLimit;
    if (updates.timeout !== undefined) fieldsToUpdate.timeout = updates.timeout;

    // Update provider with only the provided fields
    const provider = await providerRepository.updatePartial(id, fieldsToUpdate);

    if (!provider) {
      throw new AppError('Provider not found after update', 500, 'PROVIDER_UPDATE_FAILED');
    }

    logger.info({ providerId: provider.id, name: provider.name }, 'Provider updated');

    // Reload provider service to pick up changes
    await this.reloadProviders();

    return this.formatProvider(provider);
  },

  /**
   * Enable provider
   */
  async enableProvider(id) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    await providerRepository.updateEnabled(id, true);
    logger.info({ providerId: id, name: provider.name }, 'Provider enabled');

    // Reload provider service
    await this.reloadProviders();

    return this.formatProvider(await providerRepository.findById(id));
  },

  /**
   * Disable provider
   */
  async disableProvider(id) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    await providerRepository.updateEnabled(id, false);
    logger.info({ providerId: id, name: provider.name }, 'Provider disabled');

    // Reload provider service
    await this.reloadProviders();

    return this.formatProvider(await providerRepository.findById(id));
  },

  /**
   * Update provider priority
   */
  async updatePriority(id, priority) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    await providerRepository.updatePriority(id, priority);
    logger.info({ providerId: id, name: provider.name, priority }, 'Provider priority updated');

    // Reload provider service
    await this.reloadProviders();

    return this.formatProvider(await providerRepository.findById(id));
  },

  /**
   * Delete provider
   */
  async deleteProvider(id) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    await providerRepository.delete(id);
    logger.info({ providerId: id, name: provider.name }, 'Provider deleted');

    // Reload provider service
    await this.reloadProviders();
  },

  /**
   * Reload all providers (reinitialize provider service)
   */
  async reloadProviders() {
    try {
      providerService.initialized = false;
      await providerService.initialize();
      logger.info('Providers reloaded successfully');
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to reload providers');
      throw new AppError('Failed to reload providers', 500, 'PROVIDER_RELOAD_FAILED');
    }
  },

  /**
   * Check provider health
   */
  async checkHealth(id) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError('Provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    const health = await providerService.checkProviderHealth(provider.name);
    return {
      providerId: provider.id,
      name: provider.name,
      ...health
    };
  },

  /**
   * Format provider for API response (mask API key)
   */
  formatProvider(provider) {
    // Parse config if it's a string, otherwise use as-is
    let config = {};
    if (provider.config) {
      if (typeof provider.config === 'string') {
        try {
          config = JSON.parse(provider.config);
        } catch (err) {
          config = {};
        }
      } else {
        config = provider.config;
      }
    }

    return {
      id: provider.id,
      name: provider.name,
      displayName: provider.display_name,
      enabled: Boolean(provider.enabled),
      priority: provider.priority,
      apiBaseUrl: provider.api_base_url,
      apiKeyMasked: this.maskApiKey(provider.api_key_encrypted),
      webhookSecretMasked: this.maskWebhookSecret(provider.webhook_secret_encrypted),
      rateLimit: provider.rate_limit,
      timeout: provider.timeout,
      config: config,
      createdAt: provider.created_at,
      updatedAt: provider.updated_at
    };
  },

  /**
   * Mask API key for security
   */
  maskApiKey(encrypted) {
    if (!encrypted) return 'NOT_SET';
    const parts = encrypted.split(':');
    if (parts.length !== 3) return 'INVALID';
    return `****${parts[2].slice(-4)}`;
  },

  /**
   * Mask webhook secret for security
   */
  maskWebhookSecret(encrypted) {
    if (!encrypted) return 'NOT_SET';
    const parts = encrypted.split(':');
    if (parts.length !== 3) return 'INVALID';
    return `****${parts[2].slice(-4)}`;
  },

  /**
   * Parse config - handles both string and object
   */
  parseConfig(config) {
    if (!config) return {};
    if (typeof config === 'object') return config;
    try {
      return JSON.parse(config);
    } catch (err) {
      return {};
    }
  }
};

module.exports = providerAdminService;
