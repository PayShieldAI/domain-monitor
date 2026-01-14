class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode(statusCode);
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  getDefaultCode(statusCode) {
    const codes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR'
    };
    return codes[statusCode] || 'ERROR';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message
      }
    };
  }
}

module.exports = AppError;
