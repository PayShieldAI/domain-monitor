const crypto = require('crypto');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;

const cryptoUtils = {
  async hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  },

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  },

  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  },

  async hashToken(token) {
    return bcrypt.hash(token, BCRYPT_ROUNDS);
  },

  async compareToken(token, hash) {
    return bcrypt.compare(token, hash);
  },

  generateWebhookSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  },

  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = this.generateWebhookSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  },

  generateWebhookSecret() {
    return `whs_${crypto.randomBytes(24).toString('base64url')}`;
  }
};

module.exports = cryptoUtils;
