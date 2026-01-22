const apiKeyService = require('../services/apiKeyService');

const apiKeyController = {
  async createApiKey(req, res, next) {
    try {
      const { name, permissions, description, expiresAt } = req.body;
      const userId = req.user.id; // Superadmin who created it

      const result = await apiKeyService.createApiKey({
        name,
        userId,
        permissions,
        description,
        expiresAt
      });

      res.status(201).json({
        message: 'API key created successfully',
        data: result,
        warning: 'Store this API key securely. It will not be shown again.'
      });
    } catch (err) {
      next(err);
    }
  },

  async listApiKeys(req, res, next) {
    try {
      const includeRevoked = req.query.includeRevoked === 'true';
      const apiKeys = await apiKeyService.listApiKeys(includeRevoked);

      res.json({
        message: 'API keys retrieved successfully',
        data: apiKeys
      });
    } catch (err) {
      next(err);
    }
  },

  async getApiKey(req, res, next) {
    try {
      const { id } = req.params;
      const apiKey = await apiKeyService.getApiKeyById(id);

      res.json({
        message: 'API key retrieved successfully',
        data: apiKey
      });
    } catch (err) {
      next(err);
    }
  },

  async updateApiKey(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, permissions, expiresAt } = req.body;

      const result = await apiKeyService.updateApiKey(id, {
        name,
        description,
        permissions,
        expiresAt
      });

      res.json({
        message: 'API key updated successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async revokeApiKey(req, res, next) {
    try {
      const { id } = req.params;
      const result = await apiKeyService.revokeApiKey(id);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async deleteApiKey(req, res, next) {
    try {
      const { id } = req.params;
      const result = await apiKeyService.deleteApiKey(id);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
};

module.exports = apiKeyController;
