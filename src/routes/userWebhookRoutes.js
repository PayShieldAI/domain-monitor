const express = require('express');
const userWebhookController = require('../controllers/userWebhookController');
const { authenticateFlexible } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  webhookEndpointIdSchema,
  listDeliveriesQuerySchema
} = require('../validators/userWebhookSchemas');

const router = express.Router();

// All routes require authentication (JWT or API key)
router.use(authenticateFlexible);

// List all delivery logs (with optional userId filter)
router.get('/deliveries', validate(listDeliveriesQuerySchema, 'query'), userWebhookController.listAllDeliveries);

// Create webhook endpoint
router.post('/', validate(createWebhookEndpointSchema), userWebhookController.createEndpoint);

// List user's webhook endpoints
router.get('/', userWebhookController.listEndpoints);

// Get specific webhook endpoint
router.get('/:id', validate(webhookEndpointIdSchema, 'params'), userWebhookController.getEndpoint);

// Update webhook endpoint
router.patch('/:id', validate(webhookEndpointIdSchema, 'params'), validate(updateWebhookEndpointSchema), userWebhookController.updateEndpoint);

// Delete webhook endpoint
router.delete('/:id', validate(webhookEndpointIdSchema, 'params'), userWebhookController.deleteEndpoint);

// Regenerate webhook secret
router.post('/:id/regenerate-secret', validate(webhookEndpointIdSchema, 'params'), userWebhookController.regenerateSecret);

// Test webhook endpoint
router.post('/:id/test', validate(webhookEndpointIdSchema, 'params'), userWebhookController.testEndpoint);

// Get delivery logs
router.get('/:id/deliveries', validate(webhookEndpointIdSchema, 'params'), userWebhookController.getDeliveryLogs);

module.exports = router;
