const apiKeyRepository = require('../repositories/apiKeyRepository');
const cryptoUtils = require('../utils/crypto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const apiKeyService = {
  /**
   * Generate a new API key
   * Format: dmk_{random_32_chars} (Domain Monitor Key)
   */
  generateApiKey() {
    const randomPart = cryptoUtils.generateToken(16); // 32 hex chars
    return `dmk_${randomPart}`;
  },

  /**
   * Extract prefix from API key (first 12 chars for identification)
   */
  extractPrefix(apiKey) {
    return apiKey.substring(0, 12);
  },

  /**
   * Create a new API key
   */
  async createApiKey({ name, userId, permissions, description, expiresAt }) {
    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new AppError('API key name is required', 400, 'INVALID_INPUT');
    }

    // Generate API key
    const apiKey = this.generateApiKey();
    const keyPrefix = this.extractPrefix(apiKey);
    const keyHash = await cryptoUtils.hashToken(apiKey);

    // Parse expiresAt if provided
    let expirationDate = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        throw new AppError('Invalid expiration date', 400, 'INVALID_EXPIRY');
      }
      if (expirationDate <= new Date()) {
        throw new AppError('Expiration date must be in the future', 400, 'INVALID_EXPIRY');
      }
    }

    // Create in database
    const apiKeyRecord = await apiKeyRepository.create({
      name: name.trim(),
      keyHash,
      keyPrefix,
      userId,
      permissions: permissions || [],
      description: description?.trim() || null,
      expiresAt: expirationDate
    });

    logger.info(
      { apiKeyId: apiKeyRecord.id, name, userId },
      'API key created'
    );

    // Return the plain API key only once (never stored in plain text)
    return {
      id: apiKeyRecord.id,
      apiKey, // Only returned on creation
      keyPrefix,
      name: apiKeyRecord.name,
      permissions: apiKeyRecord.permissions,
      description: apiKeyRecord.description,
      expiresAt: apiKeyRecord.expires_at,
      createdAt: apiKeyRecord.created_at
    };
  },

  /**
   * Verify an API key and return associated data
   */
  async verifyApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('dmk_')) {
      throw new AppError('Invalid API key format', 401, 'INVALID_API_KEY');
    }

    const keyPrefix = this.extractPrefix(apiKey);

    // Find by prefix first (performance optimization)
    const apiKeyRecord = await apiKeyRepository.findByPrefix(keyPrefix);

    if (!apiKeyRecord) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Verify the full key hash
    const isValid = await cryptoUtils.compareToken(apiKey, apiKeyRecord.key_hash);

    if (!isValid) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Check if expired
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) <= new Date()) {
      throw new AppError('API key has expired', 401, 'API_KEY_EXPIRED');
    }

    // Check if revoked
    if (apiKeyRecord.revoked_at) {
      throw new AppError('API key has been revoked', 401, 'API_KEY_REVOKED');
    }

    // Update last used timestamp (async, don't wait)
    apiKeyRepository.updateLastUsed(apiKeyRecord.id).catch(err => {
      logger.error({ err, apiKeyId: apiKeyRecord.id }, 'Failed to update API key last used');
    });

    logger.info({ apiKeyId: apiKeyRecord.id, name: apiKeyRecord.name }, 'API key authenticated');

    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      permissions: apiKeyRecord.permissions || [],
      userId: apiKeyRecord.user_id
    };
  },

  /**
   * List all API keys (without sensitive data)
   */
  async listApiKeys(includeRevoked = false) {
    const apiKeys = includeRevoked
      ? await apiKeyRepository.findAll()
      : await apiKeyRepository.findAllActive();

    return apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      permissions: key.permissions,
      description: key.description,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      revokedAt: key.revoked_at,
      createdAt: key.created_at,
      createdBy: key.created_by_email
        ? {
            email: key.created_by_email,
            name: key.created_by_name
          }
        : null
    }));
  },

  /**
   * Get API key details by ID
   */
  async getApiKeyById(id) {
    const apiKey = await apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.key_prefix,
      permissions: apiKey.permissions,
      description: apiKey.description,
      lastUsedAt: apiKey.last_used_at,
      expiresAt: apiKey.expires_at,
      revokedAt: apiKey.revoked_at,
      createdAt: apiKey.created_at,
      updatedAt: apiKey.updated_at,
      createdBy: apiKey.created_by_email
        ? {
            email: apiKey.created_by_email,
            name: apiKey.created_by_name
          }
        : null
    };
  },

  /**
   * Update API key metadata
   */
  async updateApiKey(id, { name, description, permissions, expiresAt }) {
    const existingKey = await apiKeyRepository.findById(id);

    if (!existingKey) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    if (existingKey.revoked_at) {
      throw new AppError('Cannot update revoked API key', 400, 'API_KEY_REVOKED');
    }

    // Parse expiresAt if provided
    let expirationDate = undefined;
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        expirationDate = null;
      } else {
        expirationDate = new Date(expiresAt);
        if (isNaN(expirationDate.getTime())) {
          throw new AppError('Invalid expiration date', 400, 'INVALID_EXPIRY');
        }
        if (expirationDate <= new Date()) {
          throw new AppError('Expiration date must be in the future', 400, 'INVALID_EXPIRY');
        }
      }
    }

    const updated = await apiKeyRepository.update(id, {
      name: name?.trim(),
      description: description?.trim(),
      permissions,
      expiresAt: expirationDate
    });

    logger.info({ apiKeyId: id }, 'API key updated');

    return this.getApiKeyById(id);
  },

  /**
   * Revoke an API key
   */
  async revokeApiKey(id) {
    const apiKey = await apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    if (apiKey.revoked_at) {
      throw new AppError('API key is already revoked', 400, 'ALREADY_REVOKED');
    }

    await apiKeyRepository.revoke(id);

    logger.info({ apiKeyId: id, name: apiKey.name }, 'API key revoked');

    return { message: 'API key revoked successfully' };
  },

  /**
   * Delete an API key (hard delete)
   */
  async deleteApiKey(id) {
    const apiKey = await apiKeyRepository.findById(id);

    if (!apiKey) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    await apiKeyRepository.delete(id);

    logger.info({ apiKeyId: id, name: apiKey.name }, 'API key deleted');

    return { message: 'API key deleted successfully' };
  }
};

module.exports = apiKeyService;
