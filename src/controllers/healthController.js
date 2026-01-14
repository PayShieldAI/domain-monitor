const db = require('../config/database');

const healthController = {
  async check(_req, res) {
    const dbHealth = await db.healthCheck();

    const health = {
      status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth.status
      }
    };

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  }
};

module.exports = healthController;
