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

function requireAdmin(req, _res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (req.user.role !== 'admin') {
    return next(new AppError('Admin access required', 403, 'FORBIDDEN'));
  }

  next();
}

module.exports = { authenticate, requireAdmin };
