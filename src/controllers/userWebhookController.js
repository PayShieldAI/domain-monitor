const userWebhookService = require('../services/userWebhookService');
const { isSuperadmin, isReseller } = require('../middlewares/auth');
const logger = require('../utils/logger');

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

      // Log the raw request
      logger.info({
        requestBodyUserId: userId,
        userIdType: typeof userId,
        requestBody: { userId, url, events: events ? events.length : null, description: description ? 'provided' : null }
      }, 'Received create webhook request');

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyUser = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;

      // Use provided userId if system-level user specified it, otherwise use authenticated user's ID
      let targetUserId;
      if (canSpecifyUser && userId) {
        // System-level access with explicit userId in request body
        targetUserId = userId;
        logger.info({ decision: 'using-provided-userId', userId, canSpecifyUser }, 'Target user decision');
      } else if (!canSpecifyUser && userId) {
        // Regular user trying to specify userId - ignore it and use their own ID
        logger.warn({
          attemptedUserId: userId,
          actualUserId: userContext.id,
          userRole: userContext.role
        }, 'Non-privileged user attempted to specify userId - using authenticated user ID instead');
        targetUserId = userContext.id;
      } else {
        // No userId specified - use authenticated user's ID
        targetUserId = userContext.id;
        logger.info({
          decision: 'fallback-to-userContext',
          userContextId: userContext.id,
          providedUserId: userId,
          canSpecifyUser
        }, 'Target user decision - fallback');
      }

      // Validation: ensure targetUserId is present
      if (!targetUserId) {
        logger.error({
          requestUserId: userId,
          userContextId: userContext.id,
          isApiKey: userContext.isApiKey,
          canSpecifyUser
        }, 'User ID could not be determined');

        return next(new Error('User ID is required. When using an API key, you must specify "userId" in the request body.'));
      }

      // Log for debugging
      logger.info({
        requestUserId: userId,
        userContextId: userContext.id,
        targetUserId,
        isApiKey: userContext.isApiKey,
        canSpecifyUser,
        match: userId === targetUserId
      }, 'Creating webhook endpoint - final decision');

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

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // System-level access can view any webhook
      const isSystemAccess = userContext.isApiKey || isSuperadmin(userContext) || isReseller(userContext);

      const endpoint = await userWebhookService.getWebhookEndpoint(id, userContext.id, isSystemAccess);

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
      const { url, events, description, enabled } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // System-level access can update any webhook
      const isSystemAccess = userContext.isApiKey || isSuperadmin(userContext) || isReseller(userContext);

      const result = await userWebhookService.updateWebhookEndpoint(id, userContext.id, {
        url,
        events,
        description,
        enabled
      }, isSystemAccess);

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

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // System-level access can delete any webhook
      const isSystemAccess = userContext.isApiKey || isSuperadmin(userContext) || isReseller(userContext);

      const result = await userWebhookService.deleteWebhookEndpoint(id, userContext.id, isSystemAccess);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async regenerateSecret(req, res, next) {
    try {
      const { id } = req.params;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // System-level access can regenerate secrets for any webhook
      const isSystemAccess = userContext.isApiKey || isSuperadmin(userContext) || isReseller(userContext);

      const result = await userWebhookService.regenerateSecret(id, userContext.id, isSystemAccess);

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

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // System-level access can test any webhook
      const isSystemAccess = userContext.isApiKey || isSuperadmin(userContext) || isReseller(userContext);

      const result = await userWebhookService.testWebhookEndpoint(id, userContext.id, isSystemAccess);

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
      const { limit } = req.query;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // System-level access can view delivery logs for any webhook
      const isSystemAccess = userContext.isApiKey || isSuperadmin(userContext) || isReseller(userContext);

      const parsedLimit = parseInt(limit) || 100;
      const logs = await userWebhookService.getDeliveryLogs(id, userContext.id, parsedLimit, isSystemAccess);

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
