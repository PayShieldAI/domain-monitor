const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

function errorHandler(err, req, res, _next) {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    logger.warn({
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method
    }, 'Operational error');

    return res.status(err.statusCode).json(err.toJSON());
  }

  logger.error({
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  }, 'Unexpected error');

  const statusCode = err.statusCode || 500;
  const response = {
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message
    }
  };

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;
