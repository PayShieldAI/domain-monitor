const apiLogRepository = require('../repositories/apiLogRepository');

const apiLogController = {
  async getRecentLogs(req, res, next) {
    try {
      const { limit = 100, offset = 0 } = req.query;
      const logs = await apiLogRepository.findRecent({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        message: 'API logs retrieved successfully',
        data: logs,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          total: logs.length
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getLogById(req, res, next) {
    try {
      const { id } = req.params;
      const log = await apiLogRepository.findById(id);

      if (!log) {
        return res.status(404).json({
          message: 'API log not found',
          code: 'NOT_FOUND'
        });
      }

      res.json({
        message: 'API log retrieved successfully',
        data: log
      });
    } catch (err) {
      next(err);
    }
  },

  async getLogsByUserId(req, res, next) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const logs = await apiLogRepository.findByUserId(userId, {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        message: 'User API logs retrieved successfully',
        data: logs,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          total: logs.length
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getErrorLogs(req, res, next) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const logs = await apiLogRepository.findErrors({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.json({
        message: 'Error logs retrieved successfully',
        data: logs,
        pagination: {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
          total: logs.length
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      const stats = await apiLogRepository.getStats(startDate, endDate);

      res.json({
        message: 'API statistics retrieved successfully',
        data: stats
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteOldLogs(req, res, next) {
    try {
      const { days = 90 } = req.body;
      const deletedCount = await apiLogRepository.deleteOlderThan(parseInt(days, 10));

      res.json({
        message: `Deleted ${deletedCount} API logs older than ${days} days`,
        data: {
          deletedCount,
          days: parseInt(days, 10)
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = apiLogController;
