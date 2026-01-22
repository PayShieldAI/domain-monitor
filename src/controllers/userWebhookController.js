const userWebhookService = require('../services/userWebhookService');

const userWebhookController = {
  async createEndpoint(req, res, next) {
    try {
      const { url, events, description } = req.body;
      const userId = req.user.id;

      const result = await userWebhookService.createWebhookEndpoint({
        userId,
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
      const userId = req.user.id;
      const endpoints = await userWebhookService.listWebhookEndpoints(userId);

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
      const userId = req.user.id;

      const endpoint = await userWebhookService.getWebhookEndpoint(id, userId);

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
      const userId = req.user.id;

      const result = await userWebhookService.updateWebhookEndpoint(id, userId, {
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
      const userId = req.user.id;

      const result = await userWebhookService.deleteWebhookEndpoint(id, userId);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async regenerateSecret(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const result = await userWebhookService.regenerateSecret(id, userId);

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
      const userId = req.user.id;

      const result = await userWebhookService.testWebhookEndpoint(id, userId);

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
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 100;

      const logs = await userWebhookService.getDeliveryLogs(id, userId, limit);

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
