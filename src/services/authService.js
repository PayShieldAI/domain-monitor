const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const cryptoUtils = require('../utils/crypto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const authService = {
  async register(email, password, name, role = 'merchant') {
    // Check if email already exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    // Hash password
    const passwordHash = await cryptoUtils.hashPassword(password);

    // Create user
    const user = await userRepository.create({ email, passwordHash, name, role });

    logger.info({ userId: user.id, email, role }, 'User registered');

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  },

  async login(email, password) {
    // Find user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const isValid = await cryptoUtils.comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    // Update last login
    await userRepository.updateLastLogin(user.id);

    logger.info({ userId: user.id }, 'User logged in');

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getAccessTokenExpirySeconds()
    };
  },

  generateAccessToken(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiry
    });
  },

  async generateRefreshToken(userId) {
    const token = cryptoUtils.generateToken(32);
    const tokenHash = await cryptoUtils.hashToken(token);
    const expiresAt = this.getRefreshTokenExpiry();

    await userRepository.createRefreshToken({
      userId,
      tokenHash,
      expiresAt
    });

    return token;
  },

  async refreshAccessToken(refreshToken) {
    // Find all active refresh tokens for validation
    // We need to iterate through them because tokens are hashed
    const tokenHash = await cryptoUtils.hashToken(refreshToken);

    // Since we can't do direct comparison with hashed tokens,
    // we need a different approach - store a token identifier
    // For now, let's use a simpler approach with the token hash lookup

    // Actually, we need to find by iterating (bcrypt hashes are unique per hash)
    // Let's use a different strategy: store token hash directly (SHA256)

    // For MVP, let's verify by finding user's tokens and comparing
    const allUsers = await this.findRefreshTokenOwner(refreshToken);
    if (!allUsers) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const { user, tokenRecord } = allUsers;

    if (user.status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    // Generate new access token
    const accessToken = this.generateAccessToken(user);

    // Optionally rotate refresh token (more secure)
    await userRepository.revokeRefreshToken(tokenRecord.id);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    logger.info({ userId: user.id }, 'Token refreshed');

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.getAccessTokenExpirySeconds()
    };
  },

  async findRefreshTokenOwner(refreshToken) {
    // This is a simplified approach - in production you might want
    // to store a searchable hash (SHA256) alongside the bcrypt hash
    const { query } = require('../config/database');

    const sql = `
      SELECT rt.*, u.id as uid, u.email, u.role, u.status
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.expires_at > NOW()
        AND rt.revoked_at IS NULL
    `;
    const tokens = await query(sql, []);

    for (const token of tokens) {
      const isMatch = await cryptoUtils.compareToken(refreshToken, token.token_hash);
      if (isMatch) {
        return {
          user: {
            id: token.uid,
            email: token.email,
            role: token.role,
            status: token.status
          },
          tokenRecord: token
        };
      }
    }

    return null;
  },

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
  },

  async logout(userId) {
    await userRepository.revokeAllRefreshTokens(userId);
    logger.info({ userId }, 'User logged out');
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isValid = await cryptoUtils.comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    const newPasswordHash = await cryptoUtils.hashPassword(newPassword);
    await userRepository.updatePassword(userId, newPasswordHash);

    // Revoke all refresh tokens for security
    await userRepository.revokeAllRefreshTokens(userId);

    logger.info({ userId }, 'Password changed');
  },

  async requestPasswordReset(email) {
    const user = await userRepository.findByEmail(email);

    // Don't reveal if email exists
    if (!user) {
      logger.info({ email }, 'Password reset requested for non-existent email');
      return;
    }

    const token = cryptoUtils.generateToken(32);
    const tokenHash = await cryptoUtils.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await userRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    logger.info({ userId: user.id }, 'Password reset token created');

    // In production, send email here
    // For MVP, just return the token (remove in production!)
    return { token, email: user.email };
  },

  async resetPassword(token, newPassword) {
    // Find valid reset token
    const { query: dbQuery } = require('../config/database');

    const sql = `
      SELECT * FROM password_reset_tokens
      WHERE expires_at > NOW()
        AND used_at IS NULL
    `;
    const tokens = await dbQuery(sql, []);

    let resetToken = null;
    for (const t of tokens) {
      const isMatch = await cryptoUtils.compareToken(token, t.token_hash);
      if (isMatch) {
        resetToken = t;
        break;
      }
    }

    if (!resetToken) {
      throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
    }

    // Update password
    const passwordHash = await cryptoUtils.hashPassword(newPassword);
    await userRepository.updatePassword(resetToken.user_id, passwordHash);

    // Mark token as used
    await userRepository.markPasswordResetTokenUsed(resetToken.id);

    // Revoke all refresh tokens
    await userRepository.revokeAllRefreshTokens(resetToken.user_id);

    logger.info({ userId: resetToken.user_id }, 'Password reset completed');
  },

  getAccessTokenExpirySeconds() {
    const expiry = config.jwt.accessExpiry;
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] || 60);
  },

  getRefreshTokenExpiry() {
    const expiry = config.jwt.refreshExpiry;
    const match = expiry.match(/^(\d+)([smhd])$/);

    let ms = 7 * 24 * 60 * 60 * 1000; // default 7 days
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      ms = value * (multipliers[unit] || 86400000);
    }

    return new Date(Date.now() + ms);
  },

  async generateTokenForUser(userId) {
    // Find user by ID
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user is active
    if (user.status !== 'active') {
      throw new AppError('User account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    // Generate access token
    const accessToken = this.generateAccessToken(user);

    logger.info({ userId: user.id, generatedFor: user.email }, 'Token generated by superadmin');

    return {
      accessToken,
      expiresIn: this.getAccessTokenExpirySeconds(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    };
  }
};

module.exports = authService;
