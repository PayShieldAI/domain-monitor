const request = require('supertest');
const app = require('../../src/app');

// Mock the database
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ status: 'ok' })
}));

jest.mock('../../src/repositories/userRepository');
jest.mock('../../src/utils/crypto');

const userRepository = require('../../src/repositories/userRepository');
const cryptoUtils = require('../../src/utils/crypto');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      cryptoUtils.hashPassword.mockResolvedValue('hashed_password');
      userRepository.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test1234',
          name: 'Test User'
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('should return 422 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test1234'
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak'
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate email', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Test1234'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      role: 'user',
      status: 'active'
    };

    it('should login successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      cryptoUtils.comparePassword.mockResolvedValue(true);
      cryptoUtils.generateToken.mockReturnValue('refresh-token');
      cryptoUtils.hashToken.mockResolvedValue('hashed-refresh');
      userRepository.createRefreshToken.mockResolvedValue('token-id');
      userRepository.updateLastLogin.mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test1234'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('expiresIn');
    });

    it('should return 401 for invalid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test1234'
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 422 for missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 422 for missing refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should always return success (prevent email enumeration)', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If the email exists');
    });
  });

  describe('Protected routes', () => {
    it('should return 401 for logout without token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
    });

    it('should return 401 for change-password without token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          currentPassword: 'Old1234',
          newPassword: 'New1234'
        });

      expect(res.status).toBe(401);
    });
  });
});

describe('Health Check', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.checks).toHaveProperty('database');
  });
});
