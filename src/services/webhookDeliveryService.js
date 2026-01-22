const axios = require('axios');
const crypto = require('crypto');
const userWebhookRepository = require('../repositories/userWebhookRepository');
const logger = require('../utils/logger');

const webhookDeliveryService = {
  // Configuration
  MAX_RETRIES: 3,
  RETRY_DELAYS: [60000, 300000, 900000], // 1min, 5min, 15min
  TIMEOUT_MS: 10000, // 10 seconds

  /**
   * Deliver webhook event to user endpoint
   */
  async deliverWebhook(endpoint, eventType, payload, domainId = null, attemptNumber = 1) {
    const logId = await userWebhookRepository.createDeliveryLog({
      endpointId: endpoint.id,
      eventType,
      domainId,
      attemptNumber,
      requestBody: payload
    });

    const startTime = Date.now();

    try {
      // Generate signature
      const signature = this.generateSignature(payload, endpoint.secret);

      // Update log: sending
      await userWebhookRepository.updateDeliveryLog(logId, {
        status: 'pending',
        sentAt: new Date()
      });

      logger.info(
        { endpointId: endpoint.id, eventType, attempt: attemptNumber, url: endpoint.url },
        'Sending webhook to user endpoint'
      );

      // Send webhook
      const response = await axios.post(endpoint.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery-Id': logId,
          'User-Agent': 'DomainMonitor-Webhook/1.0'
        },
        timeout: this.TIMEOUT_MS,
        validateStatus: () => true // Don't throw on any status code
      });

      const duration = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;

      // Update log: completed
      await userWebhookRepository.updateDeliveryLog(logId, {
        status: success ? 'success' : 'failed',
        responseStatus: response.status,
        responseBody: JSON.stringify(response.data).substring(0, 1000),
        completedAt: new Date(),
        durationMs: duration,
        errorMessage: success ? null : `HTTP ${response.status}`,
        nextRetryAt: success ? null : this.getNextRetryTime(attemptNumber)
      });

      // Update endpoint stats
      if (success) {
        await this.updateEndpointStats(endpoint.id, true);
        logger.info(
          { endpointId: endpoint.id, eventType, duration, status: response.status },
          'Webhook delivered successfully'
        );
      } else {
        await this.updateEndpointStats(endpoint.id, false);
        logger.warn(
          { endpointId: endpoint.id, eventType, duration, status: response.status, attempt: attemptNumber },
          'Webhook delivery failed'
        );

        // Schedule retry if we haven't exceeded max attempts
        if (attemptNumber < this.MAX_RETRIES) {
          await userWebhookRepository.updateDeliveryLog(logId, {
            status: 'retrying'
          });
          logger.info(
            { endpointId: endpoint.id, attempt: attemptNumber + 1, retryAt: this.getNextRetryTime(attemptNumber) },
            'Webhook scheduled for retry'
          );
        }
      }

      return { success, logId, status: response.status };

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        { err: error, endpointId: endpoint.id, eventType, attempt: attemptNumber },
        'Webhook delivery error'
      );

      // Update log: error
      await userWebhookRepository.updateDeliveryLog(logId, {
        status: attemptNumber < this.MAX_RETRIES ? 'retrying' : 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
        durationMs: duration,
        nextRetryAt: attemptNumber < this.MAX_RETRIES ? this.getNextRetryTime(attemptNumber) : null
      });

      // Update endpoint stats
      await this.updateEndpointStats(endpoint.id, false);

      return { success: false, logId, error: error.message };
    }
  },

  /**
   * Deliver event to all subscribed user endpoints
   */
  async deliverToUserEndpoints(userId, eventType, payload, domainId = null) {
    const endpoints = await userWebhookRepository.findActiveByUserIdAndEvent(userId, eventType);

    if (endpoints.length === 0) {
      logger.debug({ userId, eventType }, 'No webhook endpoints subscribed to event');
      return [];
    }

    logger.info(
      { userId, eventType, endpointCount: endpoints.length },
      'Delivering webhook to user endpoints'
    );

    const results = [];

    for (const endpoint of endpoints) {
      const result = await this.deliverWebhook(endpoint, eventType, payload, domainId, 1);
      results.push({
        endpointId: endpoint.id,
        url: endpoint.url,
        ...result
      });
    }

    return results;
  },

  /**
   * Retry failed webhook deliveries
   */
  async processRetries() {
    const pendingRetries = await userWebhookRepository.findPendingRetries();

    if (pendingRetries.length === 0) {
      return { processed: 0 };
    }

    logger.info({ count: pendingRetries.length }, 'Processing webhook retries');

    let successCount = 0;
    let failCount = 0;

    for (const log of pendingRetries) {
      try {
        // Get endpoint details
        const endpoint = await userWebhookRepository.findById(log.endpoint_id);

        if (!endpoint) {
          logger.warn({ logId: log.id }, 'Endpoint not found for retry, skipping');
          continue;
        }

        if (!endpoint.enabled) {
          logger.info({ logId: log.id, endpointId: endpoint.id }, 'Endpoint disabled, skipping retry');
          await userWebhookRepository.updateDeliveryLog(log.id, {
            status: 'failed',
            errorMessage: 'Endpoint disabled'
          });
          continue;
        }

        // Retry delivery
        const result = await this.deliverWebhook(
          endpoint,
          log.event_type,
          log.request_body,
          log.domain_id,
          log.attempt_number + 1
        );

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

      } catch (error) {
        logger.error({ err: error, logId: log.id }, 'Error processing retry');
        failCount++;
      }
    }

    logger.info({ successCount, failCount, total: pendingRetries.length }, 'Webhook retries processed');

    return { processed: pendingRetries.length, successCount, failCount };
  },

  /**
   * Generate webhook signature
   */
  generateSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest('hex')}`;
  },

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  },

  /**
   * Get next retry time based on attempt number
   */
  getNextRetryTime(attemptNumber) {
    if (attemptNumber >= this.MAX_RETRIES) {
      return null;
    }

    const delay = this.RETRY_DELAYS[attemptNumber - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
    return new Date(Date.now() + delay);
  },

  /**
   * Update endpoint delivery statistics
   */
  async updateEndpointStats(endpointId, success) {
    const endpoint = await userWebhookRepository.findById(endpointId);

    if (!endpoint) return;

    const updates = {
      totalDeliveries: endpoint.total_deliveries + 1
    };

    if (success) {
      updates.successfulDeliveries = endpoint.successful_deliveries + 1;
      updates.failedDeliveries = 0; // Reset consecutive failures
      updates.lastDeliveryAt = new Date();
    } else {
      updates.failedDeliveries = endpoint.failed_deliveries + 1;

      // Auto-disable endpoint after 10 consecutive failures
      if (updates.failedDeliveries >= 10) {
        logger.warn(
          { endpointId, failedDeliveries: updates.failedDeliveries },
          'Auto-disabling endpoint due to consecutive failures'
        );
        await userWebhookRepository.update(endpointId, { enabled: false });
      }
    }

    await userWebhookRepository.updateStats(endpointId, updates);
  },

  /**
   * Test webhook endpoint
   */
  async testEndpoint(endpoint) {
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Domain Monitor'
      }
    };

    return this.deliverWebhook(endpoint, 'webhook.test', testPayload);
  }
};

module.exports = webhookDeliveryService;
