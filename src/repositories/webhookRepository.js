const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const webhookRepository = {
  async create({ provider, eventType, payload, signature, verified = false }) {
    const id = uuid();
    const sql = `
      INSERT INTO webhook_events (id, provider, event_type, payload, signature, verified, received_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    await query(sql, [id, provider, eventType, JSON.stringify(payload), signature, verified]);
    return this.findById(id);
  },

  async findById(id) {
    const sql = 'SELECT * FROM webhook_events WHERE id = ?';
    const event = await queryOne(sql, [id]);
    if (event && event.payload && typeof event.payload === 'string') {
      try {
        event.payload = JSON.parse(event.payload);
      } catch (err) {
        // Already parsed or invalid JSON, leave as is
      }
    }
    return event;
  },

  async updateProcessed(id, domainId, success, errorMessage = null) {
    const sql = `
      UPDATE webhook_events
      SET processed = ?,
          domain_id = ?,
          processed_at = NOW(),
          error_message = ?
      WHERE id = ?
    `;
    await query(sql, [success, domainId, errorMessage, id]);
    return this.findById(id);
  },

  async findByProvider(provider, options = {}) {
    const { limit = 100, offset = 0, processed = null } = options;

    let sql = 'SELECT * FROM webhook_events WHERE provider = ?';
    const params = [provider];

    if (processed !== null) {
      sql += ' AND processed = ?';
      params.push(processed);
    }

    sql += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const events = await query(sql, params);
    return events.map(e => {
      if (e.payload && typeof e.payload === 'string') {
        try {
          e.payload = JSON.parse(e.payload);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      return e;
    });
  },

  async findUnprocessed(provider = null) {
    let sql = 'SELECT * FROM webhook_events WHERE processed = FALSE';
    const params = [];

    if (provider) {
      sql += ' AND provider = ?';
      params.push(provider);
    }

    sql += ' ORDER BY received_at ASC LIMIT 100';

    const events = await query(sql, params);
    return events.map(e => {
      if (e.payload && typeof e.payload === 'string') {
        try {
          e.payload = JSON.parse(e.payload);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      return e;
    });
  }
};

module.exports = webhookRepository;
