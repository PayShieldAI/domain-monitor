const cryptoUtils = require('../../src/utils/crypto');

describe('CryptoUtils', () => {
  describe('hashPassword / comparePassword', () => {
    it('should hash and verify password', async () => {
      const password = 'TestPassword123';
      const hash = await cryptoUtils.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);

      const isValid = await cryptoUtils.comparePassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await cryptoUtils.comparePassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate random token of specified length', () => {
      const token = cryptoUtils.generateToken(32);
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars

      const token2 = cryptoUtils.generateToken(32);
      expect(token).not.toBe(token2);
    });

    it('should use default length if not specified', () => {
      const token = cryptoUtils.generateToken();
      expect(token.length).toBe(64);
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate webhook secret with prefix', () => {
      const secret = cryptoUtils.generateWebhookSecret();
      expect(secret.startsWith('whsec_')).toBe(true);
    });
  });

  describe('generateWebhookSignature / verifyWebhookSignature', () => {
    it('should generate and verify signature', () => {
      const payload = { event: 'test', data: { id: 1 } };
      const secret = 'test-secret';

      const signature = cryptoUtils.generateWebhookSignature(payload, secret);
      expect(signature.length).toBe(64); // SHA256 hex

      const isValid = cryptoUtils.verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should fail verification with wrong secret', () => {
      const payload = { event: 'test' };
      const signature = cryptoUtils.generateWebhookSignature(payload, 'secret1');

      const isValid = cryptoUtils.verifyWebhookSignature(payload, signature, 'secret2');
      expect(isValid).toBe(false);
    });
  });
});
