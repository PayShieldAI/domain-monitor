const authService = require('../services/authService');
const apiKeyService = require('../services/apiKeyService');
const AppError = require('../utils/AppError');

function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing authorization header', 401, 'MISSING_AUTH'));
  }

  const token = authHeader.slice(7);

  try {
    const payload = authService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require superadmin role
 * Used for provider management and system-wide admin operations
 */
function requireSuperadmin(req, _res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (req.user.role !== 'superadmin') {
    return next(new AppError('Superadmin access required', 403, 'FORBIDDEN'));
  }

  next();
}

/**
 * Require merchant or reseller role (read-only users)
 * Used for endpoints that should be accessible to read-only users
 */
function requireReadOnly(req, _res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!['merchant', 'reseller'].includes(req.user.role)) {
    return next(new AppError('Access denied', 403, 'FORBIDDEN'));
  }

  next();
}

/**
 * Check if user has superadmin role
 */
function isSuperadmin(user) {
  return user && user.role === 'superadmin';
}

/**
 * Check if user has reseller role
 */
function isReseller(user) {
  return user && user.role === 'reseller';
}

/**
 * Check if user has merchant role
 */
function isMerchant(user) {
  return user && user.role === 'merchant';
}

/**
 * Authenticate using API key from X-API-Key header
 * For machine-to-machine authentication
 */
async function authenticateApiKey(req, _res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(new AppError('Missing X-API-Key header', 401, 'MISSING_API_KEY'));
  }

  try {
    const apiKeyData = await apiKeyService.verifyApiKey(apiKey);

    // Attach API key info to request
    req.apiKey = {
      id: apiKeyData.id,
      name: apiKeyData.name,
      permissions: apiKeyData.permissions
    };

    // If API key is associated with a user, attach user info too
    if (apiKeyData.userId) {
      req.apiKeyUserId = apiKeyData.userId;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Flexible authentication: accepts either Bearer token or API key
 * Checks Authorization header first, then X-API-Key header
 */
async function authenticateFlexible(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // Try Bearer token first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, next);
  }

  // Try API key second
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  // Neither provided
  return next(new AppError('Missing authentication credentials', 401, 'MISSING_AUTH'));
}

/**
 * Flexible superadmin authorization
 * - If authenticated via JWT: requires superadmin role
 * - If authenticated via API key: allows through (API keys are system-level)
 */
function requireSuperadminOrApiKey(req, _res, next) {
  // If API key was used, allow through (system-level access)
  if (req.apiKey) {
    return next();
  }

  // If JWT was used, check for superadmin role
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (req.user.role !== 'superadmin') {
    return next(new AppError('Superadmin access required', 403, 'FORBIDDEN'));
  }

  next();
}

// Backward compatibility: requireAdmin = requireSuperadmin
const requireAdmin = requireSuperadmin;

module.exports = {
  authenticate,
  authenticateApiKey,
  authenticateFlexible,
  requireAdmin, // Backward compatibility
  requireSuperadmin,
  requireSuperadminOrApiKey,
  requireReadOnly,
  isSuperadmin,
  isReseller,
  isMerchant
};
