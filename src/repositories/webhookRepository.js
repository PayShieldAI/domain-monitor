const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const webhookRepository = {
  async create({ providerId, provider, eventType, payload, signature, verified = false, alertId = null, alertResponse = null }) {
    const id = uuid();
    const sql = `
      INSERT INTO provider_webhook_events (id, provider_id, provider, event_type, payload, signature, verified, alert_id, alert_response, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await query(sql, [
      id,
      providerId || null,
      provider,
      eventType,
      JSON.stringify(payload),
      signature,
      verified,
      alertId || null,
      alertResponse ? JSON.stringify(alertResponse) : null
    ]);
    return this.findById(id);
  },

  async findById(id) {
    const sql = 'SELECT * FROM provider_webhook_events WHERE id = ?';
    const event = await queryOne(sql, [id]);
    if (event) {
      // Parse payload if it's a string
      if (event.payload && typeof event.payload === 'string') {
        try {
          event.payload = JSON.parse(event.payload);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      // Parse alert_response if it's a string
      if (event.alert_response && typeof event.alert_response === 'string') {
        try {
          event.alert_response = JSON.parse(event.alert_response);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
    }
    return event;
  },

  async updateProcessed(id, domainId, success, event_category, errorMessage = null, alertId = null, alertResponse = null) {
    const sql = `
      UPDATE provider_webhook_events
      SET processed = ?,
          domain_id = ?,
          event_category = ?,
          processed_at = NOW(),
          error_message = ?,
          alert_id = ?,
          alert_response = ?
      WHERE id = ?
    `;
    await query(sql, [
      success,
      domainId,
      event_category,
      errorMessage,
      alertId || null,
      alertResponse ? JSON.stringify(alertResponse) : null,
      id
    ]);
    return this.findById(id);
  },

  async findByProvider(provider, options = {}) {
    const { limit = 100, offset = 0, processed = null } = options;

    let sql = 'SELECT * FROM provider_webhook_events WHERE provider = ?';
    const params = [provider];

    if (processed !== null) {
      sql += ' AND processed = ?';
      params.push(processed);
    }

    sql += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const events = await query(sql, params);
    return events.map(e => {
      // Parse payload if it's a string
      if (e.payload && typeof e.payload === 'string') {
        try {
          e.payload = JSON.parse(e.payload);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      // Parse alert_response if it's a string
      if (e.alert_response && typeof e.alert_response === 'string') {
        try {
          e.alert_response = JSON.parse(e.alert_response);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      return e;
    });
  },

  async findUnprocessed(provider = null) {
    let sql = 'SELECT * FROM provider_webhook_events WHERE processed = FALSE';
    const params = [];

    if (provider) {
      sql += ' AND provider = ?';
      params.push(provider);
    }

    sql += ' ORDER BY received_at ASC LIMIT 100';

    const events = await query(sql, params);
    return events.map(e => {
      // Parse payload if it's a string
      if (e.payload && typeof e.payload === 'string') {
        try {
          e.payload = JSON.parse(e.payload);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      // Parse alert_response if it's a string
      if (e.alert_response && typeof e.alert_response === 'string') {
        try {
          e.alert_response = JSON.parse(e.alert_response);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      return e;
    });
  },

   async findWithFilters(filters = {}) {
    const {
      provider,
      domainId,
      status,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0
    } = filters;

    let sql = 'SELECT * FROM provider_webhook_events WHERE 1=1';
    const params = [];

    if (provider) {
      sql += ' AND provider = ?';
      params.push(provider);
    }

    if (domainId) {
      sql += ' AND domain_id = ?';
      params.push(domainId);
    }

    if (status !== undefined && status !== null) {
      sql += ' AND processed = ?';
      params.push(status);
    }

    if (dateFrom) {
      sql += ' AND received_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ' AND received_at <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const events = await query(sql, params);
    return events.map(e => {
      // Parse payload if it's a string
      if (e.payload && typeof e.payload === 'string') {
        try {
          e.payload = JSON.parse(e.payload);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      // Parse alert_response if it's a string
      if (e.alert_response && typeof e.alert_response === 'string') {
        try {
          e.alert_response = JSON.parse(e.alert_response);
        } catch (err) {
          // Already parsed or invalid JSON, leave as is
        }
      }
      return e;
    });
  },

  async countWithFilters(filters = {}) {
    const {
      provider,
      domainId,
      status,
      dateFrom,
      dateTo
    } = filters;

    let sql = 'SELECT COUNT(*) as total FROM provider_webhook_events WHERE 1=1';
    const params = [];

    if (provider) {
      sql += ' AND provider = ?';
      params.push(provider);
    }

    if (domainId) {
      sql += ' AND domain_id = ?';
      params.push(domainId);
    }

    if (status !== undefined && status !== null) {
      sql += ' AND processed = ?';
      params.push(status);
    }

    if (dateFrom) {
      sql += ' AND received_at >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ' AND received_at <= ?';
      params.push(dateTo);
    }

    const result = await queryOne(sql, params);
    return result ? result.total : 0;
  }
};

module.exports = webhookRepository;
