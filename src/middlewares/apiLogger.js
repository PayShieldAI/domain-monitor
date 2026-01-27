const apiLogRepository = require('../repositories/apiLogRepository');
const logger = require('../utils/logger');

// Sensitive headers that should never be logged
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'set-cookie',
  'x-auth-token',
  'x-csrf-token'
];

// Request body fields that should be redacted
const SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
  'secret',
  'apiKey',
  'accessToken'
];

// Maximum size for logged payloads (in characters)
const MAX_PAYLOAD_SIZE = 10000;

/**
 * Sanitize headers by removing sensitive information
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };

  SENSITIVE_HEADERS.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Recursively redact sensitive fields from an object
 */
function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Truncate large payloads to prevent database bloat
 */
function truncatePayload(data, maxSize = MAX_PAYLOAD_SIZE) {
  if (!data) return null;

  const stringified = typeof data === 'string' ? data : JSON.stringify(data);

  if (stringified.length > maxSize) {
    return stringified.substring(0, maxSize) + '... [TRUNCATED]';
  }

  return data;
}

/**
 * Extract IP address from request
 */
function getIpAddress(req) {
  return req.ip ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         null;
}

/**
 * API Logger Middleware
 * Logs all API requests and responses to the database
 */
function apiLogger(options = {}) {
  const {
    enabled = true,
    logRequestBody = true,
    logResponseBody = false, // Disabled by default for performance
    skipPaths = ['/health', '/metrics'], // Paths to skip logging
    skipMethods = [] // Methods to skip logging
  } = options;

  return (req, res, next) => {
    // Skip if logging is disabled
    if (!enabled) {
      return next();
    }

    // Skip certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip certain methods
    if (skipMethods.includes(req.method)) {
      return next();
    }

    const startTime = Date.now();

    // Capture request data
    const requestData = {
      method: req.method,
      path: req.path,
      queryParams: Object.keys(req.query).length > 0 ? req.query : null,
      headers: sanitizeHeaders(req.headers),
      requestBody: logRequestBody && req.body ? redactSensitiveData(req.body) : null,
      ipAddress: getIpAddress(req),
      userAgent: req.headers['user-agent']?.substring(0, 500) || null,
      userId: req.user?.id || null
    };

    // Capture original res.json and res.send
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseBody = null;

    // Override res.json to capture response
    res.json = function(data) {
      if (logResponseBody) {
        responseBody = truncatePayload(data);
      }
      return originalJson(data);
    };

    // Override res.send to capture response
    res.send = function(data) {
      if (logResponseBody && data) {
        try {
          responseBody = truncatePayload(JSON.parse(data));
        } catch (err) {
          responseBody = truncatePayload(data);
        }
      }
      return originalSend(data);
    };

    // Log when response is finished
    res.on('finish', () => {
      const durationMs = Date.now() - startTime;

      // Log to database asynchronously (don't block response)
      setImmediate(async () => {
        try {
          await apiLogRepository.create({
            userId: requestData.userId,
            method: requestData.method,
            path: requestData.path,
            queryParams: requestData.queryParams,
            headers: requestData.headers,
            requestBody: truncatePayload(requestData.requestBody),
            responseStatus: res.statusCode,
            responseBody,
            durationMs,
            ipAddress: requestData.ipAddress,
            userAgent: requestData.userAgent,
            errorMessage: res.statusCode >= 400 ? res.statusMessage : null
          });
        } catch (err) {
          // Don't fail the request if logging fails
          logger.error({ err, path: requestData.path }, 'Failed to log API request');
        }
      });
    });

    next();
  };
}

module.exports = apiLogger;
