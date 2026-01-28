const providerAdminService = require('../services/providerAdminService');
const logger = require('../utils/logger');

/**
 * Provider Controller
 * Handles provider management endpoints (admin only)
 */
const providerController = {
  /**
   * List all providers
   * GET /api/v1/admin/providers
   */
  async list(req, res, next) {
    try {
      const providers = await providerAdminService.listProviders();
      res.json({
        success: true,
        data: providers,
        count: providers.length
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get provider by ID
   * GET /api/v1/admin/providers/:id
   */
  async getById(req, res, next) {
    try {
      const provider = await providerAdminService.getProviderById(req.params.id);
      res.json({
        success: true,
        data: provider
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get provider by name
   * GET /api/v1/admin/providers/name/:name
   */
  async getByName(req, res, next) {
    try {
      const provider = await providerAdminService.getProviderByName(req.params.name);
      res.json({
        success: true,
        data: provider
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create new provider
   * POST /api/v1/admin/providers
   */
  async create(req, res, next) {
    try {
      const provider = await providerAdminService.createProvider(req.body);

      logger.info(
        { userId: req.user?.id, providerId: provider.id, providerName: provider.name },
        'Provider created by admin'
      );

      res.status(201).json({
        success: true,
        data: provider,
        message: 'Provider created successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update provider
   * PATCH /api/v1/admin/providers/:id
   */
  async update(req, res, next) {
    try {
      const provider = await providerAdminService.updateProvider(req.params.id, req.body);

      logger.info(
        { userId: req.user?.id, providerId: provider.id, providerName: provider.name },
        'Provider updated by admin'
      );

      res.json({
        success: true,
        data: provider,
        message: 'Provider updated successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Enable provider
   * PATCH /api/v1/admin/providers/:id/enable
   */
  async enable(req, res, next) {
    try {
      const provider = await providerAdminService.enableProvider(req.params.id);

      logger.info(
        { userId: req.user?.id, providerId: provider.id, providerName: provider.name },
        'Provider enabled by admin'
      );

      res.json({
        success: true,
        data: provider,
        message: 'Provider enabled successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Disable provider
   * PATCH /api/v1/admin/providers/:id/disable
   */
  async disable(req, res, next) {
    try {
      const provider = await providerAdminService.disableProvider(req.params.id);

      logger.info(
        { userId: req.user?.id, providerId: provider.id, providerName: provider.name },
        'Provider disabled by admin'
      );

      res.json({
        success: true,
        data: provider,
        message: 'Provider disabled successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update provider priority
   * PATCH /api/v1/admin/providers/:id/priority
   */
  async updatePriority(req, res, next) {
    try {
      const provider = await providerAdminService.updatePriority(req.params.id, req.body.priority);

      logger.info(
        { userId: req.user?.id, providerId: provider.id, providerName: provider.name, priority: provider.priority },
        'Provider priority updated by admin'
      );

      res.json({
        success: true,
        data: provider,
        message: 'Provider priority updated successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete provider
   * DELETE /api/v1/admin/providers/:id
   */
  async delete(req, res, next) {
    try {
      await providerAdminService.deleteProvider(req.params.id);

      logger.info(
        { userId: req.user?.id, providerId: req.params.id },
        'Provider deleted by admin'
      );

      res.json({
        success: true,
        message: 'Provider deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reload all providers
   * POST /api/v1/admin/providers/reload
   */
  async reload(req, res, next) {
    try {
      await providerAdminService.reloadProviders();

      logger.info(
        { userId: req.user.id },
        'Providers reloaded by admin'
      );

      res.json({
        success: true,
        message: 'Providers reloaded successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check provider health
   * GET /api/v1/admin/providers/:id/health
   */
  async checkHealth(req, res, next) {
    try {
      const health = await providerAdminService.checkHealth(req.params.id);
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      next(error);
    }
  },

};

module.exports = providerController;
