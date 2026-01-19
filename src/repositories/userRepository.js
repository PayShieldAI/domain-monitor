const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const userRepository = {
  async create({ email, passwordHash, name, role = 'merchant' }) {
    const id = uuid();
    const sql = `
      INSERT INTO users (id, email, password_hash, name, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', NOW())
    `;
    await query(sql, [id, email, passwordHash, name || null, role]);
    return this.findById(id);
  },

  async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return queryOne(sql, [id]);
  },

  async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return queryOne(sql, [email]);
  },

  async updateLastLogin(id) {
    const sql = 'UPDATE users SET last_login_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  },

  async updatePassword(id, passwordHash) {
    const sql = 'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [passwordHash, id]);
  },

  async updateProfile(id, { name, email }) {
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
    return this.findById(id);
  },

  // Refresh Token Methods
  async createRefreshToken({ userId, tokenHash, expiresAt }) {
    const id = uuid();
    const sql = `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    await query(sql, [id, userId, tokenHash, expiresAt]);
    return id;
  },

  async findRefreshTokenByHash(tokenHash) {
    const sql = `
      SELECT rt.*, u.id as user_id, u.email, u.role, u.status
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = ?
        AND rt.expires_at > NOW()
        AND rt.revoked_at IS NULL
    `;
    return queryOne(sql, [tokenHash]);
  },

  async findActiveRefreshTokensByUserId(userId) {
    const sql = `
      SELECT * FROM refresh_tokens
      WHERE user_id = ?
        AND expires_at > NOW()
        AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    return query(sql, [userId]);
  },

  async revokeRefreshToken(id) {
    const sql = 'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  },

  async revokeAllRefreshTokens(userId) {
    const sql = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE user_id = ? AND revoked_at IS NULL
    `;
    await query(sql, [userId]);
  },

  // Password Reset Token Methods
  async createPasswordResetToken({ userId, tokenHash, expiresAt }) {
    const id = uuid();
    const sql = `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    await query(sql, [id, userId, tokenHash, expiresAt]);
    return id;
  },

  async findPasswordResetToken(tokenHash) {
    const sql = `
      SELECT * FROM password_reset_tokens
      WHERE token_hash = ?
        AND expires_at > NOW()
        AND used_at IS NULL
    `;
    return queryOne(sql, [tokenHash]);
  },

  async markPasswordResetTokenUsed(id) {
    const sql = 'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  }
};

module.exports = userRepository;
