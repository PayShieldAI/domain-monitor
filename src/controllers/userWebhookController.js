const userWebhookService = require('../services/userWebhookService');
const { isSuperadmin, isReseller } = require('../middlewares/auth');

/**
 * Helper to get user context from either JWT or API key authentication
 * @param {Object} req - Express request object
 * @returns {Object} User context with id and role
 */
function getUserContext(req) {
  // JWT authentication
  if (req.user) {
    return req.user;
  }

  // API key authentication - API keys have system-level access
  if (req.apiKey) {
    return {
      id: req.apiKeyUserId,
      role: 'system', // API keys treated as system-level
      isApiKey: true
    };
  }

  return null;
}

const userWebhookController = {
  async createEndpoint(req, res, next) {
    try {
      const { userId, url, events, description } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const result = await userWebhookService.createWebhookEndpoint({
        userId: targetUserId,
        url,
        events,
        description
      });

      res.status(201).json({
        message: 'Webhook endpoint created successfully',
        data: result,
        warning: 'Store the secret securely. It will not be shown again.'
      });
    } catch (err) {
      next(err);
    }
  },

  async listEndpoints(req, res, next) {
    try {
      const { userId } = req.query;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const endpoints = await userWebhookService.listWebhookEndpoints(targetUserId);

      res.json({
        message: 'Webhook endpoints retrieved successfully',
        data: endpoints
      });
    } catch (err) {
      next(err);
    }
  },

  async getEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const endpoint = await userWebhookService.getWebhookEndpoint(id, targetUserId);

      res.json({
        message: 'Webhook endpoint retrieved successfully',
        data: endpoint
      });
    } catch (err) {
      next(err);
    }
  },

  async updateEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, url, events, description, enabled } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const result = await userWebhookService.updateWebhookEndpoint(id, targetUserId, {
        url,
        events,
        description,
        enabled
      });

      res.json({
        message: 'Webhook endpoint updated successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.query;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const result = await userWebhookService.deleteWebhookEndpoint(id, targetUserId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async regenerateSecret(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const result = await userWebhookService.regenerateSecret(id, targetUserId);

      res.json({
        message: result.message,
        data: {
          secret: result.secret
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async testEndpoint(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const result = await userWebhookService.testWebhookEndpoint(id, targetUserId);

      res.json({
        message: result.message,
        data: {
          success: result.success,
          status: result.status,
          deliveryLogId: result.deliveryLogId
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getDeliveryLogs(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, limit } = req.query;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyUser && userId
        ? userId
        : userContext.id;

      const parsedLimit = parseInt(limit) || 100;
      const logs = await userWebhookService.getDeliveryLogs(id, targetUserId, parsedLimit);

      res.json({
        message: 'Delivery logs retrieved successfully',
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = userWebhookController;
