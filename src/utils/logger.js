const pino = require('pino');

const level = process.env.LOG_LEVEL || 'info';

const logger = pino({
  level,
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'domain-monitor',
    env: process.env.NODE_ENV || 'development'
  }
});

module.exports = logger;
