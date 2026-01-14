const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    return this.formatUserResponse(user);
  },

  async updateProfile(userId, updates) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if email is being changed and if it's already taken
    if (updates.email && updates.email !== user.email) {
      const existingUser = await userRepository.findByEmail(updates.email);
      if (existingUser) {
        throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');
      }
    }

    const updatedUser = await userRepository.updateProfile(userId, updates);
    logger.info({ userId }, 'User profile updated');

    return this.formatUserResponse(updatedUser);
  },

  formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.email_verified_at,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  }
};

module.exports = userService;
