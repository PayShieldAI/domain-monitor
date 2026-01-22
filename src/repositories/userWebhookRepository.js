const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const userWebhookRepository = {
  async create({ userId, url, events, secret, description }) {
    const id = uuid();
    const sql = `
      INSERT INTO webhooks (
        id, user_id, url, events, secret, description, enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
    `;
    await query(sql, [
      id,
      userId,
      url,
      JSON.stringify(events),
      secret,
      description || null
    ]);
    return this.findById(id);
  },

  async findById(id) {
    const sql = 'SELECT * FROM webhooks WHERE id = ?';
    const result = await queryOne(sql, [id]);
    return this.parseWebhookEndpoint(result);
  },

  async findByUserId(userId) {
    const sql = `
      SELECT * FROM webhooks
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const results = await query(sql, [userId]);
    return results.map(r => this.parseWebhookEndpoint(r));
  },

  async findActiveByUserIdAndEvent(userId, eventType) {
    const sql = `
      SELECT * FROM webhooks
      WHERE user_id = ?
        AND enabled = TRUE
        AND (events IS NULL OR JSON_CONTAINS(events, ?, '$'))
    `;
    const results = await query(sql, [userId, JSON.stringify(eventType)]);
    return results.map(r => this.parseWebhookEndpoint(r));
  },

  async update(id, { url, events, description, enabled }) {
    const fields = [];
    const values = [];

    if (url !== undefined) {
      fields.push('url = ?');
      values.push(url);
    }
    if (events !== undefined) {
      fields.push('events = ?');
      values.push(JSON.stringify(events));
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(enabled);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const sql = `UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
    return this.findById(id);
  },

  async updateStats(id, { lastDeliveryAt, failedDeliveries, totalDeliveries, successfulDeliveries }) {
    const fields = [];
    const values = [];

    if (lastDeliveryAt !== undefined) {
      fields.push('last_delivery_at = ?');
      values.push(lastDeliveryAt);
    }
    if (failedDeliveries !== undefined) {
      fields.push('failed_deliveries = ?');
      values.push(failedDeliveries);
    }
    if (totalDeliveries !== undefined) {
      fields.push('total_deliveries = ?');
      values.push(totalDeliveries);
    }
    if (successfulDeliveries !== undefined) {
      fields.push('successful_deliveries = ?');
      values.push(successfulDeliveries);
    }

    if (fields.length === 0) return;

    values.push(id);

    const sql = `UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
  },

  async delete(id) {
    const sql = 'DELETE FROM webhooks WHERE id = ?';
    await query(sql, [id]);
  },

  async regenerateSecret(id, newSecret) {
    const sql = 'UPDATE webhooks SET secret = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [newSecret, id]);
    return this.findById(id);
  },

  // Delivery logs
  async createDeliveryLog({ endpointId, eventType, domainId, attemptNumber, requestBody }) {
    const id = uuid();
    const sql = `
      INSERT INTO webhook_delivery_logs (
        id, webhook_id, event_type, domain_id, attempt_number,
        status, request_body, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NOW())
    `;
    await query(sql, [
      id,
      endpointId,
      eventType,
      domainId || null,
      attemptNumber,
      JSON.stringify(requestBody),
      JSON.stringify(requestBody) // payload is the same as request_body
    ]);
    return id;
  },

  async updateDeliveryLog(id, { status, responseStatus, responseBody, errorMessage, sentAt, completedAt, durationMs, nextRetryAt }) {
    const fields = [];
    const values = [];

    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status);
    }
    if (responseStatus !== undefined) {
      fields.push('response_status = ?');
      values.push(responseStatus);
    }
    if (responseBody !== undefined) {
      fields.push('response_body = ?');
      values.push(responseBody);
    }
    if (errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(errorMessage);
    }
    if (sentAt !== undefined) {
      fields.push('sent_at = ?');
      values.push(sentAt);
    }
    if (completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(completedAt);
    }
    if (durationMs !== undefined) {
      fields.push('duration_ms = ?');
      values.push(durationMs);
    }
    if (nextRetryAt !== undefined) {
      fields.push('next_retry_at = ?');
      values.push(nextRetryAt);
    }

    if (fields.length === 0) return;

    values.push(id);

    const sql = `UPDATE webhook_delivery_logs SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
  },

  async findDeliveryLogsByEndpoint(endpointId, limit = 100) {
    const sql = `
      SELECT * FROM webhook_delivery_logs
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const results = await query(sql, [endpointId, limit]);
    return results.map(r => this.parseDeliveryLog(r));
  },

  async findPendingRetries() {
    const sql = `
      SELECT * FROM webhook_delivery_logs
      WHERE status = 'retrying'
        AND next_retry_at <= NOW()
      ORDER BY next_retry_at ASC
      LIMIT 100
    `;
    const results = await query(sql, []);
    return results.map(r => this.parseDeliveryLog(r));
  },

  parseWebhookEndpoint(row) {
    if (!row) return null;

    let events = row.events;
    if (typeof events === 'string') {
      try {
        events = JSON.parse(events);
      } catch (err) {
        events = [];
      }
    }

    return {
      ...row,
      events,
      enabled: Boolean(row.enabled)
    };
  },

  parseDeliveryLog(row) {
    if (!row) return null;

    let requestBody = row.request_body;
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (err) {
        requestBody = null;
      }
    }

    return {
      ...row,
      request_body: requestBody
    };
  }
};

module.exports = userWebhookRepository;
