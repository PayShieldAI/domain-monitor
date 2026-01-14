const domainService = require('../services/domainService');
const { parsePaginationParams } = require('../utils/pagination');

const domainController = {
  async create(req, res, next) {
    try {
      const { domain, checkFrequency } = req.body;
      const result = await domainService.addDomain(req.user.id, domain, checkFrequency);

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
      const { domains } = req.body;
      const result = await domainService.addDomainsBulk(req.user.id, domains);

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const result = await domainService.getDomain(req.user.id, req.params.id);

      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async getDetails(req, res, next) {
    try {
      const result = await domainService.getDomainDetails(req.user.id, req.params.id);

      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async bulkRetrieve(req, res, next) {
    try {
      const { ids } = req.body;
      const result = await domainService.getDomainsBulk(req.user.id, ids);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { page, limit } = parsePaginationParams(req.query);
      const { status, recommendation, search, sortBy, sortOrder } = req.query;

      const result = await domainService.listDomains(req.user.id, {
        page,
        limit,
        status,
        recommendation,
        search,
        sortBy,
        sortOrder
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async stop(req, res, next) {
    try {
      const result = await domainService.stopMonitoring(req.user.id, req.params.id);

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
      const { ids } = req.body;
      const result = await domainService.stopMonitoringBulk(req.user.id, ids);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async start(req, res, next) {
    try {
      const result = await domainService.startMonitoring(req.user.id, req.params.id);

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
      const { ids } = req.body;
      const result = await domainService.startMonitoringBulk(req.user.id, ids);

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getHistory(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const result = await domainService.getCheckHistory(req.user.id, req.params.id, limit);

      res.json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = domainController;
