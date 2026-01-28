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
  async upsert({ name, displayName, apiBaseUrl, apiKeyEncrypted, webhookSecretEncrypted = null, enabled = true, priority = 100, rateLimit = 60, timeout = 10000, config = {} }) {
    const existing = await this.findByName(name);

    if (existing) {
      const sql = `
        UPDATE providers
        SET display_name = ?,
            api_base_url = ?,
            api_key_encrypted = ?,
            webhook_secret_encrypted = ?,
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
        webhookSecretEncrypted,
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
        INSERT INTO providers (id, name, display_name, api_base_url, api_key_encrypted, webhook_secret_encrypted, enabled, priority, rate_limit, timeout, config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await query(sql, [
        id,
        name,
        displayName,
        apiBaseUrl,
        apiKeyEncrypted,
        webhookSecretEncrypted,
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
   * Update provider with partial fields (only updates provided fields)
   */
  async updatePartial(id, updates) {
    const fields = [];
    const values = [];

    // Build dynamic UPDATE query based on provided fields
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(updates.displayName);
    }
    if (updates.apiBaseUrl !== undefined) {
      fields.push('api_base_url = ?');
      values.push(updates.apiBaseUrl);
    }
    if (updates.apiKeyEncrypted !== undefined) {
      fields.push('api_key_encrypted = ?');
      values.push(updates.apiKeyEncrypted);
    }
    if (updates.webhookSecretEncrypted !== undefined) {
      fields.push('webhook_secret_encrypted = ?');
      values.push(updates.webhookSecretEncrypted);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.rateLimit !== undefined) {
      fields.push('rate_limit = ?');
      values.push(updates.rateLimit);
    }
    if (updates.timeout !== undefined) {
      fields.push('timeout = ?');
      values.push(updates.timeout);
    }
    if (updates.config !== undefined) {
      fields.push('config = ?');
      values.push(JSON.stringify(updates.config));
    }

    // Always update the updated_at timestamp
    fields.push('updated_at = NOW()');

    // Add the ID for the WHERE clause
    values.push(id);

    const sql = `UPDATE providers SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);

    return this.findById(id);
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
   * Update webhook secret
   */
  async updateWebhookSecret(id, webhookSecretEncrypted) {
    const sql = 'UPDATE providers SET webhook_secret_encrypted = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [webhookSecretEncrypted, id]);
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
