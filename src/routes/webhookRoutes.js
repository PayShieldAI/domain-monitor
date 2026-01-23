const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { authenticateFlexible, requireSuperadminOrApiKey } = require('../middlewares/auth');

/**
 * Webhook Routes
 *
 * Public routes (no auth):
 * - POST /api/v1/webhooks/:provider - Receive webhook from provider
 *
 * Admin routes (superadmin or API key):
 * - GET /api/v1/webhooks/:provider/events - List webhook events
 * - POST /api/v1/webhooks/events/:id/retry - Retry failed webhook
 */

// Public webhook endpoint (no authentication - providers send to this)
router.post('/:provider', webhookController.handleWebhook);

// Admin endpoints (superadmin or API key)
router.get('/:provider/events', authenticateFlexible, requireSuperadminOrApiKey, webhookController.listWebhookEvents);
router.post('/events/:id/retry', authenticateFlexible, requireSuperadminOrApiKey, webhookController.retryWebhook);

module.exports = router;
