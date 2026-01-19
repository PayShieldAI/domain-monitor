const authService = require('../services/authService');
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

// Backward compatibility: requireAdmin = requireSuperadmin
const requireAdmin = requireSuperadmin;

module.exports = {
  authenticate,
  requireAdmin, // Backward compatibility
  requireSuperadmin,
  requireReadOnly,
  isSuperadmin,
  isReseller,
  isMerchant
};
