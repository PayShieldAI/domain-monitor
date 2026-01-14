const authService = require('../../src/services/authService');
const userRepository = require('../../src/repositories/userRepository');
const cryptoUtils = require('../../src/utils/crypto');
const AppError = require('../../src/utils/AppError');

// Mock dependencies
jest.mock('../../src/repositories/userRepository');
jest.mock('../../src/utils/crypto');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const email = 'test@example.com';
      const password = 'Test1234';
      const name = 'Test User';

      userRepository.findByEmail.mockResolvedValue(null);
      cryptoUtils.hashPassword.mockResolvedValue('hashed_password');
      userRepository.create.mockResolvedValue({
        id: 'user-123',
        email,
        name
      });

      const result = await authService.register(email, password, name);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(cryptoUtils.hashPassword).toHaveBeenCalledWith(password);
      expect(userRepository.create).toHaveBeenCalledWith({
        email,
        passwordHash: 'hashed_password',
        name
      });
      expect(result).toEqual({
        userId: 'user-123',
        email,
        name
      });
    });

    it('should throw error if email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(
        authService.register('existing@example.com', 'Test1234', 'Test')
      ).rejects.toThrow(AppError);

      await expect(
        authService.register('existing@example.com', 'Test1234', 'Test')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'EMAIL_EXISTS'
      });
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      role: 'user',
      status: 'active'
    };

    it('should login successfully with valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      cryptoUtils.comparePassword.mockResolvedValue(true);
      cryptoUtils.generateToken.mockReturnValue('refresh-token');
      cryptoUtils.hashToken.mockResolvedValue('hashed-refresh-token');
      userRepository.createRefreshToken.mockResolvedValue('token-id');
      userRepository.updateLastLogin.mockResolvedValue();

      const result = await authService.login('test@example.com', 'Test1234');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should throw error for invalid email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login('nonexistent@example.com', 'Test1234')
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should throw error for invalid password', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      cryptoUtils.comparePassword.mockResolvedValue(false);

      await expect(
        authService.login('test@example.com', 'WrongPassword')
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should throw error for inactive account', async () => {
      userRepository.findByEmail.mockResolvedValue({
        ...mockUser,
        status: 'inactive'
      });

      await expect(
        authService.login('test@example.com', 'Test1234')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_INACTIVE'
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid token', () => {
      const token = authService.generateAccessToken({
        id: 'user-123',
        email: 'test@example.com',
        role: 'user'
      });

      const payload = authService.verifyAccessToken(token);

      expect(payload.sub).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
      expect(payload.role).toBe('user');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow(AppError);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        id: 'user-123',
        password_hash: 'old_hash'
      };

      userRepository.findById.mockResolvedValue(mockUser);
      cryptoUtils.comparePassword.mockResolvedValue(true);
      cryptoUtils.hashPassword.mockResolvedValue('new_hash');
      userRepository.updatePassword.mockResolvedValue();
      userRepository.revokeAllRefreshTokens.mockResolvedValue();

      await authService.changePassword('user-123', 'OldPass123', 'NewPass123');

      expect(cryptoUtils.comparePassword).toHaveBeenCalledWith('OldPass123', 'old_hash');
      expect(cryptoUtils.hashPassword).toHaveBeenCalledWith('NewPass123');
      expect(userRepository.updatePassword).toHaveBeenCalledWith('user-123', 'new_hash');
      expect(userRepository.revokeAllRefreshTokens).toHaveBeenCalledWith('user-123');
    });

    it('should throw error for incorrect current password', async () => {
      userRepository.findById.mockResolvedValue({
        id: 'user-123',
        password_hash: 'hash'
      });
      cryptoUtils.comparePassword.mockResolvedValue(false);

      await expect(
        authService.changePassword('user-123', 'WrongPass', 'NewPass123')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_PASSWORD'
      });
    });
  });

  describe('getAccessTokenExpirySeconds', () => {
    it('should parse expiry correctly', () => {
      expect(authService.getAccessTokenExpirySeconds()).toBe(900); // 15m default
    });
  });
});
