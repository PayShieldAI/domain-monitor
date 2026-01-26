const userWebhookRepository = require('../repositories/userWebhookRepository');
const webhookDeliveryService = require('./webhookDeliveryService');
const cryptoUtils = require('../utils/crypto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const userWebhookService = {
  /**
   * Create webhook endpoint for user
   */
  async createWebhookEndpoint({ userId, url, events, description }) {
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      throw new AppError('Invalid URL format', 400, 'INVALID_URL');
    }

    // Validate events array (null = subscribe to all events)
    if (events !== null && events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        throw new AppError('Events array must contain at least one event or be null for all events', 400, 'INVALID_EVENTS');
      }

      const validEvents = [
        'domain.created',
        'business-profile',
        'domain.deleted',
        'business-closed',
        'sentiment',
        'website'
      ];

      const invalidEvents = events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        throw new AppError(
          `Invalid event types: ${invalidEvents.join(', ')}`,
          400,
          'INVALID_EVENT_TYPES'
        );
      }
    }

    // Generate secret
    const secret = cryptoUtils.generateWebhookSecret();

    const endpoint = await userWebhookRepository.create({
      userId,
      url,
      events,
      secret,
      description
    });

    logger.info({ userId, endpointId: endpoint.id, url }, 'Webhook endpoint created');

    return {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      secret: endpoint.secret, // Return secret only on creation
      description: endpoint.description,
      enabled: endpoint.enabled,
      createdAt: endpoint.created_at
    };
  },

  /**
   * List user's webhook endpoints
   */
  async listWebhookEndpoints(userId) {
    const endpoints = await userWebhookRepository.findByUserId(userId);

    return endpoints.map(endpoint => ({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      description: endpoint.description,
      enabled: endpoint.enabled,
      lastDeliveryAt: endpoint.last_delivery_at,
      failedDeliveries: endpoint.failed_deliveries,
      totalDeliveries: endpoint.total_deliveries,
      successfulDeliveries: endpoint.successful_deliveries,
      createdAt: endpoint.created_at,
      updatedAt: endpoint.updated_at
    }));
  },

  /**
   * Get webhook endpoint by ID
   */
  async getWebhookEndpoint(endpointId, userId) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) {
      throw new AppError('Webhook endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
    }

    if (endpoint.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    return {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      description: endpoint.description,
      enabled: endpoint.enabled,
      lastDeliveryAt: endpoint.last_delivery_at,
      failedDeliveries: endpoint.failed_deliveries,
      totalDeliveries: endpoint.total_deliveries,
      successfulDeliveries: endpoint.successful_deliveries,
      createdAt: endpoint.created_at,
      updatedAt: endpoint.updated_at
    };
  },

  /**
   * Update webhook endpoint
   */
  async updateWebhookEndpoint(endpointId, userId, { url, events, description, enabled }) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) {
      throw new AppError('Webhook endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
    }

    if (endpoint.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch (error) {
        throw new AppError('Invalid URL format', 400, 'INVALID_URL');
      }
    }

    // Validate events if provided (null = subscribe to all events)
    if (events !== undefined && events !== null) {
      if (!Array.isArray(events) || events.length === 0) {
        throw new AppError('Events array must contain at least one event or be null for all events', 400, 'INVALID_EVENTS');
      }

      const validEvents = [
        'domain.created',
        'business-profile',
        'domain.deleted',
        'business-closed',
        'sentiment',
        'website'
      ];

      const invalidEvents = events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        throw new AppError(
          `Invalid event types: ${invalidEvents.join(', ')}`,
          400,
          'INVALID_EVENT_TYPES'
        );
      }
    }

    const updated = await userWebhookRepository.update(endpointId, {
      url,
      events,
      description,
      enabled
    });

    logger.info({ userId, endpointId }, 'Webhook endpoint updated');

    return this.getWebhookEndpoint(endpointId, userId);
  },

  /**
   * Delete webhook endpoint
   */
  async deleteWebhookEndpoint(endpointId, userId) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) {
      throw new AppError('Webhook endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
    }

    if (endpoint.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    await userWebhookRepository.delete(endpointId);

    logger.info({ userId, endpointId }, 'Webhook endpoint deleted');

    return { message: 'Webhook endpoint deleted successfully' };
  },

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(endpointId, userId) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) {
      throw new AppError('Webhook endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
    }

    if (endpoint.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const newSecret = cryptoUtils.generateWebhookSecret();
    await userWebhookRepository.regenerateSecret(endpointId, newSecret);

    logger.info({ userId, endpointId }, 'Webhook secret regenerated');

    return {
      secret: newSecret,
      message: 'Secret regenerated successfully. Update your webhook handler with the new secret.'
    };
  },

  /**
   * Test webhook endpoint
   */
  async testWebhookEndpoint(endpointId, userId) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) {
      throw new AppError('Webhook endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
    }

    if (endpoint.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const result = await webhookDeliveryService.testEndpoint(endpoint);

    logger.info({ userId, endpointId, success: result.success }, 'Webhook endpoint tested');

    return {
      success: result.success,
      status: result.status,
      message: result.success ? 'Test webhook delivered successfully' : 'Test webhook delivery failed',
      deliveryLogId: result.logId
    };
  },

  /**
   * Get delivery logs for endpoint
   */
  async getDeliveryLogs(endpointId, userId, limit = 100) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) {
      throw new AppError('Webhook endpoint not found', 404, 'ENDPOINT_NOT_FOUND');
    }

    if (endpoint.user_id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const logs = await userWebhookRepository.findDeliveryLogsByEndpoint(endpointId, limit);

    return logs.map(log => ({
      id: log.id,
      eventType: log.event_type,
      domainId: log.domain_id,
      attemptNumber: log.attempt_number,
      status: log.status,
      responseStatus: log.response_status,
      errorMessage: log.error_message,
      durationMs: log.duration_ms,
      sentAt: log.sent_at,
      completedAt: log.completed_at,
      nextRetryAt: log.next_retry_at,
      createdAt: log.created_at
    }));
  }
};

module.exports = userWebhookService;
