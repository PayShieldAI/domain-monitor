const authService = require('../services/authService');

const authController = {
  async register(req, res, next) {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register(email, password, name);

      res.status(201).json({
        message: 'Registration successful',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.json({
        message: 'Login successful',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        message: 'Token refreshed',
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id);

      res.json({
        message: 'Logout successful'
      });
    } catch (err) {
      next(err);
    }
  },

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      await authService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      res.json({
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);

      res.json({
        message: 'Password has been reset successfully'
      });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user.id, currentPassword, newPassword);

      res.json({
        message: 'Password changed successfully'
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
