const webhookRepository = require('../repositories/webhookRepository');
const domainRepository = require('../repositories/domainRepository');
const providerRepository = require('../repositories/providerRepository');
const providerService = require('../services/providerService');
const webhookDeliveryService = require('../services/webhookDeliveryService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');

const webhookController = {
  /**
   * Map provider-specific event types to user event types
   */
  mapProviderEventToUserEvent(providerEvent, provider) {
    // TrueBiz event mappings
    if (provider === 'truebiz') {
      const mappings = {
        'business-closed': 'business-closed',
        'sentiment': 'sentiment',
        'website': 'website',
        'business-profile': 'business-profile'
      };
      return mappings[providerEvent] || null;
    }

    // Add other provider mappings here
    return null;
  },

  /**
   * Handle incoming webhook from provider
   * POST /api/v1/webhooks/:provider
   */
  async handleWebhook(req, res, next) {
    const { provider } = req.params;
    let payload = req.body;
    let verified = false;
    let signature = null;

    logger.info({
      provider,
      eventType: payload.type,
      hasRawBody: !!req.rawBody
    }, 'Received webhook');

    try {
      // Get provider config from database
      const providerConfig = await providerRepository.findByName(provider);
      if (!providerConfig) {
        throw new AppError(`Unknown provider: ${provider}`, 400, 'UNKNOWN_PROVIDER');
      }

      // Get provider instance
      await providerService.ensureInitialized();
      const providerInstance = providerService.getProvider(provider);
      if (!providerInstance) {
        throw new AppError(`Provider not initialized: ${provider}`, 500, 'PROVIDER_NOT_INITIALIZED');
      }

      //TODO -  this signature handling passed from the  provider after signature validation 
      // Extract signature from headers (provider-specific)
      // Common signature headers: x-signature, x-webhook-signature, signature
      signature = req.headers['x-signature'] ||
                  req.headers['x-webhook-signature'] ||
                  req.headers['signature'] ||
                  req.headers['x-truebiz-signature'] ||
                  null;

      // Verify webhook signature using provider-specific implementation
      if (providerConfig.webhook_secret_encrypted) {
        try {
          // Get webhook secret from database (encrypted)
          const webhookSecret = decrypt(providerConfig.webhook_secret_encrypted);

          // Delegate signature verification to provider
          const rawBody = req.rawBody || JSON.stringify(payload);
          const verifiedPayload = await providerInstance.verifyWebhookSignature(
            rawBody,
            req.headers,
            webhookSecret
          );

          // Use the verified payload
          payload = verifiedPayload;
          verified = true;

          logger.info({ provider }, 'Webhook signature verified successfully');
        } catch (err) {
          logger.error({
            provider,
            error: err.message
          }, 'Webhook signature verification failed');
          throw new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
        }
      } else {
        logger.warn({ provider }, 'No webhook secret configured - skipping verification');
      }

      // Store webhook event
      const webhookEvent = await webhookRepository.create({
        provider,
        eventType: payload.type || 'unknown',
        payload,
        signature,
        verified
      });

      logger.info({
        webhookEventId: webhookEvent.id,
        provider,
        eventType: payload.type
      }, 'Webhook event stored');

      // Helper function to find domain by external_ref_id
      // Since we pass the domain ID as external_ref_id to TrueBiz,
      // we can match directly by domain ID
      const findDomainByExternalRef = async (externalRefId) => {
        return await domainRepository.findById(externalRefId);
      };

      // Process webhook with provider-specific handler
      let result;
      try {
        result = await providerInstance.handleWebhook(payload, findDomainByExternalRef);

        // Update webhook event as processed
        await webhookRepository.updateProcessed(
          webhookEvent.id,
          result.domainId || null,
          true,
          result.event_category || null,
          null
        );

        logger.info({
          webhookEventId: webhookEvent.id,
          provider,
          domainId: result.domainId,
          processed: true
        }, 'Webhook processed successfully');

        // Forward to user webhook endpoints if domain is associated with a user
        if (result.domainId) {
          try {
            const domain = await domainRepository.findById(result.domainId);
            if (domain && domain.user_id) {
              // Use event_category from provider result
              const eventCategory = result.event_category;

              // Only send webhook if event_category is present and valid
              if (eventCategory) {
                const userPayload = {
                  event: eventCategory,
                  timestamp: new Date().toISOString(),
                  data: {
                    domainId: result.domainId,
                    domain: domain.domain,
                    status: domain.status,
                    provider,
                    providerEvent: payload.type,
                    providerData: payload
                  }
                };

                // Deliver asynchronously (don't wait)
                // This will automatically check if user is subscribed to this event_category
                webhookDeliveryService.deliverToUserEndpoints(
                  domain.user_id,
                  eventCategory,
                  userPayload,
                  result.domainId
                ).catch(err => {
                  logger.error({ err, domainId: result.domainId }, 'Failed to deliver user webhooks');
                });

                logger.info({
                  userId: domain.user_id,
                  domainId: result.domainId,
                  eventCategory
                }, 'Webhook forwarded to user endpoints');
              } else {
                logger.debug({
                  userId: domain.user_id,
                  domainId: result.domainId,
                  providerEvent: payload.type
                }, 'No event_category mapped for provider event - webhook not forwarded to user');
              }
            }
          } catch (err) {
            logger.error({ err, domainId: result.domainId }, 'Error forwarding webhook to user');
          }
        }

      } catch (error) {
        // Update webhook event with error
        await webhookRepository.updateProcessed(
          webhookEvent.id,
          null,
          false,
          null,
          error.message
        );

        logger.error({
          webhookEventId: webhookEvent.id,
          provider,
          error: error.message
        }, 'Failed to process webhook');

        throw error;
      }

      // Return 200 OK to acknowledge receipt
      res.status(200).json({
        success: true,
        message: 'Webhook received and processed',
        webhookEventId: webhookEvent.id,
        processed: result.processed
      });

    } catch (error) {
      next(error);
    }
  },

  /**
   * List webhook events (admin only)
   * GET /api/v1/webhooks/:provider/events
   */
  async listWebhookEvents(req, res, next) {
    const { provider } = req.params;
    const { limit = 100, offset = 0, processed } = req.query;

    try {
      const events = await webhookRepository.findByProvider(provider, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        processed: processed !== undefined ? processed === 'true' : null
      });

      res.json({
        success: true,
        data: events,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: events.length
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retry failed webhook
   * POST /api/v1/webhooks/events/:id/retry
   */
  async retryWebhook(req, res, next) {
    const { id } = req.params;

    try {
      const webhookEvent = await webhookRepository.findById(id);
      if (!webhookEvent) {
        throw new AppError('Webhook event not found', 404, 'WEBHOOK_NOT_FOUND');
      }

      // Get provider instance
      const providerInstance = await providerService.getProviderByName(webhookEvent.provider);
      if (!providerInstance) {
        throw new AppError(`Provider not found: ${webhookEvent.provider}`, 400, 'PROVIDER_NOT_FOUND');
      }

      // Helper function to find domain by external_ref_id
      // Since we pass the domain ID as external_ref_id to TrueBiz,
      // we can match directly by domain ID
      const findDomainByExternalRef = async (externalRefId) => {
        return await domainRepository.findById(externalRefId);
      };

      // Retry processing
      const result = await providerInstance.handleWebhook(webhookEvent.payload, findDomainByExternalRef);

      // Update webhook event
      await webhookRepository.updateProcessed(
        webhookEvent.id,
        result.domainId || null,
        result.event_category || null,
        true,
        null
      );

      res.json({
        success: true,
        message: 'Webhook retried successfully',
        webhookEventId: webhookEvent.id,
        result
      });

    } catch (error) {
      // Update with new error message
      await webhookRepository.updateProcessed(id, null, false, null, error.message);
      next(error);
    }
  }
};

module.exports = webhookController;
