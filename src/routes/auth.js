const express = require('express');
const authController = require('../controllers/authController');
const { authenticate, authenticateFlexible, requireSuperadminOrApiKey } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  generateUserTokenSchema
} = require('../validators/authSchemas');

const router = express.Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.get('/me/token', authenticate, authController.getMyToken);

// Superadmin-only routes (supports both JWT and API key authentication)
router.post('/generate-user-token', authenticateFlexible, requireSuperadminOrApiKey, validate(generateUserTokenSchema), authController.generateUserToken);

module.exports = router;
