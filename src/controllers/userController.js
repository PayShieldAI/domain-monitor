const userService = require('../services/userService');

const userController = {
  async getProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.user.id);

      res.json({
        data: profile
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const profile = await userService.updateProfile(req.user.id, req.body);

      res.json({
        message: 'Profile updated successfully',
        data: profile
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = userController;
