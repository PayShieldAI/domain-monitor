const express = require('express');
const providerController = require('../controllers/providerController');
const { authenticate, requireAdmin } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createProviderSchema,
  updateProviderSchema,
  providerIdSchema,
  providerNameSchema,
  updatePrioritySchema
} = require('../validators/providerSchemas');

const router = express.Router();

// All provider routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * @route   GET /api/v1/admin/providers
 * @desc    List all providers
 * @access  Admin
 */
router.get('/', providerController.list);

/**
 * @route   POST /api/v1/admin/providers
 * @desc    Create new provider
 * @access  Admin
 */
router.post('/', validate(createProviderSchema, 'body'), providerController.create);

/**
 * @route   POST /api/v1/admin/providers/reload
 * @desc    Reload all providers
 * @access  Admin
 */
router.post('/reload', providerController.reload);

/**
 * @route   GET /api/v1/admin/providers/name/:name
 * @desc    Get provider by name
 * @access  Admin
 */
router.get('/name/:name', validate(providerNameSchema, 'params'), providerController.getByName);

/**
 * @route   GET /api/v1/admin/providers/:id
 * @desc    Get provider by ID
 * @access  Admin
 */
router.get('/:id', validate(providerIdSchema, 'params'), providerController.getById);

/**
 * @route   PATCH /api/v1/admin/providers/:id
 * @desc    Update provider
 * @access  Admin
 */
router.patch('/:id', validate(providerIdSchema, 'params'), validate(updateProviderSchema, 'body'), providerController.update);

/**
 * @route   PATCH /api/v1/admin/providers/:id/enable
 * @desc    Enable provider
 * @access  Admin
 */
router.patch('/:id/enable', validate(providerIdSchema, 'params'), providerController.enable);

/**
 * @route   PATCH /api/v1/admin/providers/:id/disable
 * @desc    Disable provider
 * @access  Admin
 */
router.patch('/:id/disable', validate(providerIdSchema, 'params'), providerController.disable);

/**
 * @route   PATCH /api/v1/admin/providers/:id/priority
 * @desc    Update provider priority
 * @access  Admin
 */
router.patch('/:id/priority', validate(providerIdSchema, 'params'), validate(updatePrioritySchema, 'body'), providerController.updatePriority);

/**
 * @route   DELETE /api/v1/admin/providers/:id
 * @desc    Delete provider
 * @access  Admin
 */
router.delete('/:id', validate(providerIdSchema, 'params'), providerController.delete);

/**
 * @route   GET /api/v1/admin/providers/:id/health
 * @desc    Check provider health
 * @access  Admin
 */
router.get('/:id/health', validate(providerIdSchema, 'params'), providerController.checkHealth);

module.exports = router;
