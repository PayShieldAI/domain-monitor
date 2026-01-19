const { query, queryOne } = require('../config/database');
const { v4: uuid } = require('uuid');

const providerRepository = {
  /**
   * Get all enabled providers ordered by priority
   */
  async getAllEnabled() {
    const sql = `
      SELECT * FROM providers
      WHERE enabled = TRUE
      ORDER BY priority ASC, created_at ASC
    `;
    return query(sql);
  },

  /**
   * Get provider by name
   */
  async findByName(name) {
    const sql = 'SELECT * FROM providers WHERE name = ?';
    return queryOne(sql, [name]);
  },

  /**
   * Get provider by ID
   */
  async findById(id) {
    const sql = 'SELECT * FROM providers WHERE id = ?';
    return queryOne(sql, [id]);
  },

  /**
   * Create or update provider
   */
  async upsert({ name, displayName, apiBaseUrl, apiKeyEncrypted, enabled = true, priority = 100, rateLimit = 60, timeout = 10000, config = {} }) {
    const existing = await this.findByName(name);

    if (existing) {
      const sql = `
        UPDATE providers
        SET display_name = ?,
            api_base_url = ?,
            api_key_encrypted = ?,
            enabled = ?,
            priority = ?,
            rate_limit = ?,
            timeout = ?,
            config = ?,
            updated_at = NOW()
        WHERE name = ?
      `;
      await query(sql, [
        displayName,
        apiBaseUrl,
        apiKeyEncrypted,
        enabled,
        priority,
        rateLimit,
        timeout,
        JSON.stringify(config),
        name
      ]);
      return this.findByName(name);
    } else {
      const id = uuid();
      const sql = `
        INSERT INTO providers (id, name, display_name, api_base_url, api_key_encrypted, enabled, priority, rate_limit, timeout, config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await query(sql, [
        id,
        name,
        displayName,
        apiBaseUrl,
        apiKeyEncrypted,
        enabled,
        priority,
        rateLimit,
        timeout,
        JSON.stringify(config)
      ]);
      return this.findById(id);
    }
  },

  /**
   * Update provider enabled status
   */
  async updateEnabled(id, enabled) {
    const sql = 'UPDATE providers SET enabled = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [enabled, id]);
    return this.findById(id);
  },

  /**
   * Update provider priority
   */
  async updatePriority(id, priority) {
    const sql = 'UPDATE providers SET priority = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [priority, id]);
    return this.findById(id);
  },

  /**
   * Delete provider
   */
  async delete(id) {
    const sql = 'DELETE FROM providers WHERE id = ?';
    await query(sql, [id]);
  }
};

module.exports = providerRepository;
