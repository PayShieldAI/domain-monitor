const { v4: uuid } = require('uuid');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || uuid(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      remoteAddress: req.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
});

module.exports = httpLogger;
