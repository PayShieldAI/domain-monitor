const AppError = require('../../src/utils/AppError');

describe('AppError', () => {
  it('should create error with message and status code', () => {
    const error = new AppError('Not found', 404);

    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.isOperational).toBe(true);
  });

  it('should use custom code when provided', () => {
    const error = new AppError('Custom error', 400, 'CUSTOM_CODE');

    expect(error.code).toBe('CUSTOM_CODE');
  });

  it('should have default codes for common status codes', () => {
    expect(new AppError('', 400).code).toBe('BAD_REQUEST');
    expect(new AppError('', 401).code).toBe('UNAUTHORIZED');
    expect(new AppError('', 403).code).toBe('FORBIDDEN');
    expect(new AppError('', 404).code).toBe('NOT_FOUND');
    expect(new AppError('', 409).code).toBe('CONFLICT');
    expect(new AppError('', 422).code).toBe('VALIDATION_ERROR');
    expect(new AppError('', 429).code).toBe('RATE_LIMIT_EXCEEDED');
    expect(new AppError('', 500).code).toBe('INTERNAL_ERROR');
  });

  it('should serialize to JSON correctly', () => {
    const error = new AppError('Test error', 400, 'TEST_CODE');
    const json = error.toJSON();

    expect(json).toEqual({
      error: {
        code: 'TEST_CODE',
        message: 'Test error'
      }
    });
  });

  it('should be instance of Error', () => {
    const error = new AppError('Test', 500);

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('should capture stack trace', () => {
    const error = new AppError('Test', 500);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });
});
