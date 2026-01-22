const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const apiKeyRepository = {
  async create({ name, keyHash, keyPrefix, userId, permissions, description, expiresAt }) {
    const id = uuid();
    const sql = `
      INSERT INTO api_keys (
        id, name, key_hash, key_prefix, user_id, permissions, description, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await query(sql, [
      id,
      name,
      keyHash,
      keyPrefix,
      userId || null,
      permissions ? JSON.stringify(permissions) : null,
      description || null,
      expiresAt || null
    ]);
    return this.findById(id);
  },

  async findById(id) {
    const sql = `
      SELECT
        ak.*,
        u.email as created_by_email,
        u.name as created_by_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.user_id = u.id
      WHERE ak.id = ?
    `;
    const result = await queryOne(sql, [id]);
    return this.parseApiKey(result);
  },

  async findByPrefix(keyPrefix) {
    const sql = `
      SELECT * FROM api_keys
      WHERE key_prefix = ?
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    const result = await queryOne(sql, [keyPrefix]);
    return this.parseApiKey(result);
  },

  async findAllActive() {
    const sql = `
      SELECT
        ak.*,
        u.email as created_by_email,
        u.name as created_by_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.user_id = u.id
      WHERE ak.revoked_at IS NULL
      ORDER BY ak.created_at DESC
    `;
    const results = await query(sql, []);
    return results.map(r => this.parseApiKey(r));
  },

  async findAll() {
    const sql = `
      SELECT
        ak.*,
        u.email as created_by_email,
        u.name as created_by_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.user_id = u.id
      ORDER BY ak.created_at DESC
    `;
    const results = await query(sql, []);
    return results.map(r => this.parseApiKey(r));
  },

  async updateLastUsed(id) {
    const sql = 'UPDATE api_keys SET last_used_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  },

  async revoke(id) {
    const sql = 'UPDATE api_keys SET revoked_at = NOW(), updated_at = NOW() WHERE id = ?';
    await query(sql, [id]);
  },

  async update(id, { name, description, permissions, expiresAt }) {
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (permissions !== undefined) {
      fields.push('permissions = ?');
      values.push(JSON.stringify(permissions));
    }
    if (expiresAt !== undefined) {
      fields.push('expires_at = ?');
      values.push(expiresAt);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const sql = `UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
    return this.findById(id);
  },

  async delete(id) {
    const sql = 'DELETE FROM api_keys WHERE id = ?';
    await query(sql, [id]);
  },

  parseApiKey(row) {
    if (!row) return null;

    // MySQL2 automatically parses JSON columns, so no need to JSON.parse
    // If permissions is a string, it means it wasn't auto-parsed (shouldn't happen with JSON type)
    let permissions = row.permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch (err) {
        permissions = null;
      }
    }

    return {
      ...row,
      permissions
    };
  }
};

module.exports = apiKeyRepository;
