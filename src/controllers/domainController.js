const domainService = require('../services/domainService');
const { parsePaginationParams } = require('../utils/pagination');
const { isSuperadmin, isReseller } = require('../middlewares/auth');

/**
 * Helper to get user context from either JWT or API key authentication
 * @param {Object} req - Express request object
 * @returns {Object} User context with id and role
 */
function getUserContext(req) {
  // JWT authentication
  if (req.user) {
    return req.user;
  }

  // API key authentication - API keys have system-level access
  if (req.apiKey) {
    return {
      id: req.apiKeyUserId,
      role: 'system', // API keys treated as system-level
      isApiKey: true
    };
  }

  return null;
}

const domainController = {
  async create(req, res, next) {
    try {
      const { userId, ...domainData } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyMerchant = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyMerchant && userId
        ? userId
        : userContext.id;

      const result = await domainService.addDomain(targetUserId, domainData);

      res.status(201).json({
        message: 'Domain added successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async bulkCreate(req, res, next) {
    try {
      const { domains, userId } = req.body;

      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      // Determine target user: superadmin/reseller/API key can specify userId
      const canSpecifyMerchant = isSuperadmin(userContext) || isReseller(userContext) || userContext.isApiKey;
      const targetUserId = canSpecifyMerchant && userId
        ? userId
        : userContext.id;

      const result = await domainService.addDomainsBulk(targetUserId, domains);

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      const result = await domainService.getDomain(userContext, req.params.id);

      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async getDetails(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      const result = await domainService.getDomainDetails(userContext, req.params.id);

      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async bulkRetrieve(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext || !userContext.id) {
        return next(new Error('User context not found'));
      }

      const { ids } = req.body;
      const result = await domainService.getDomainsBulk(userContext.id, ids);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext) {
        return next(new Error('User context not found'));
      }

      const { page, limit } = parsePaginationParams(req.query);
      const { status, recommendation, search, sortBy, sortOrder, industry, businessType, foundedYear } = req.query;

      const result = await domainService.listDomains(userContext, {
        page,
        limit,
        status,
        recommendation,
        search,
        sortBy,
        sortOrder,
        industry,
        businessType,
        foundedYear
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async stop(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext || !userContext.id) {
        return next(new Error('User context not found'));
      }

      const result = await domainService.stopMonitoring(userContext.id, req.params.id);

      res.json({
        message: 'Monitoring stopped',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async bulkStop(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext || !userContext.id) {
        return next(new Error('User context not found'));
      }

      const { ids } = req.body;
      const result = await domainService.stopMonitoringBulk(userContext.id, ids);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async start(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext || !userContext.id) {
        return next(new Error('User context not found'));
      }

      const result = await domainService.startMonitoring(userContext.id, req.params.id);

      res.json({
        message: 'Monitoring restarted',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async bulkStart(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext || !userContext.id) {
        return next(new Error('User context not found'));
      }

      const { ids } = req.body;
      const result = await domainService.startMonitoringBulk(userContext.id, ids);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async recheckDomain(req, res, next) {
    try {
      const userContext = getUserContext(req);
      if (!userContext || !userContext.id) {
        return next(new Error('User context not found'));
      }

      const result = await domainService.recheckDomain(userContext.id, req.params.id);

      res.json({
        message: 'Domain verification check completed successfully',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = domainController;
