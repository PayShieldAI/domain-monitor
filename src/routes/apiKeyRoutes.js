const express = require('express');
const apiKeyController = require('../controllers/apiKeyController');
const { authenticateFlexible, requireSuperadminOrApiKey } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createApiKeySchema, updateApiKeySchema, apiKeyIdSchema } = require('../validators/apiKeySchemas');

const router = express.Router();

// All routes require authentication (JWT or API key) and superadmin/API key access
router.use(authenticateFlexible);
router.use(requireSuperadminOrApiKey);

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
