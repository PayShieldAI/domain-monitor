const express = require('express');
const apiKeyController = require('../controllers/apiKeyController');
const { authenticate, requireSuperadmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createApiKeySchema, updateApiKeySchema, apiKeyIdSchema } = require('../validators/apiKeySchemas');

const router = express.Router();

// All routes require superadmin authentication
router.use(authenticate);
router.use(requireSuperadmin);

// Create new API key
router.post('/', validate(createApiKeySchema), apiKeyController.createApiKey);

// List all API keys
router.get('/', apiKeyController.listApiKeys);

// Get specific API key
router.get('/:id', validate(apiKeyIdSchema, 'params'), apiKeyController.getApiKey);

// Update API key
router.patch('/:id', validate(apiKeyIdSchema, 'params'), validate(updateApiKeySchema), apiKeyController.updateApiKey);

// Revoke API key (soft delete)
router.post('/:id/revoke', validate(apiKeyIdSchema, 'params'), apiKeyController.revokeApiKey);

// Delete API key (hard delete)
router.delete('/:id', validate(apiKeyIdSchema, 'params'), apiKeyController.deleteApiKey);

module.exports = router;
