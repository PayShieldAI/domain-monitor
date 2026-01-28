const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const userWebhookRepository = {
  async create({ userId, url, events, secret, description }) {
    const id = uuid();
    const sql = `
      INSERT INTO user_webhooks (
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
    const sql = 'SELECT * FROM user_webhooks WHERE id = ?';
    const result = await queryOne(sql, [id]);
    return this.parseWebhookEndpoint(result);
  },

  async findByUserId(userId) {
    const sql = `
      SELECT * FROM user_webhooks
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const results = await query(sql, [userId]);
    return results.map(r => this.parseWebhookEndpoint(r));
  },

  async findActiveByUserIdAndEvent(userId, eventType) {
    const sql = `
      SELECT * FROM user_webhooks
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

    const sql = `UPDATE user_webhooks SET ${fields.join(', ')} WHERE id = ?`;
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

    const sql = `UPDATE user_webhooks SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
  },

  async delete(id) {
    const sql = 'DELETE FROM user_webhooks WHERE id = ?';
    await query(sql, [id]);
  },

  async regenerateSecret(id, newSecret) {
    const sql = 'UPDATE user_webhooks SET secret = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [newSecret, id]);
    return this.findById(id);
  },

  // Delivery logs
  async createDeliveryLog({ endpointId, eventType, domainId, attemptNumber, requestBody }) {
    const id = uuid();
    const sql = `
      INSERT INTO user_webhook_delivery_logs (
        id, endpoint_id, event_type, domain_id, attempt_number,
        status, request_body, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())
    `;
    await query(sql, [
      id,
      endpointId,
      eventType,
      domainId || null,
      attemptNumber,
      JSON.stringify(requestBody)
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

    const sql = `UPDATE user_webhook_delivery_logs SET ${fields.join(', ')} WHERE id = ?`;
    await query(sql, values);
  },

  async findDeliveryLogsByEndpoint(endpointId, limit = 100) {
    const sql = `
      SELECT * FROM user_webhook_delivery_logs
      WHERE endpoint_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const results = await query(sql, [endpointId, limit]);
    return results.map(r => this.parseDeliveryLog(r));
  },

  async findAllDeliveryLogs(options = {}) {
    const { userId, resellerId, page = 1, limit = 100, status, eventType, dateFrom, dateTo, domainId } = options;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 100;
    const offset = (pageNum - 1) * limitNum;

    // If resellerId is provided, join with reseller_merchant_relationships to filter by assigned merchants
    const needsResellerJoin = resellerId && !userId;

    let sql, countSql;

    if (needsResellerJoin) {
      sql = `
        SELECT dl.*, uw.user_id, uw.url as endpoint_url
        FROM user_webhook_delivery_logs dl
        INNER JOIN user_webhooks uw ON dl.endpoint_id = uw.id
        INNER JOIN reseller_merchant_relationships rmr ON uw.user_id = rmr.merchant_id
        WHERE rmr.reseller_id = ?
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM user_webhook_delivery_logs dl
        INNER JOIN user_webhooks uw ON dl.endpoint_id = uw.id
        INNER JOIN reseller_merchant_relationships rmr ON uw.user_id = rmr.merchant_id
        WHERE rmr.reseller_id = ?
      `;
    } else {
      sql = `
        SELECT dl.*, uw.user_id, uw.url as endpoint_url
        FROM user_webhook_delivery_logs dl
        INNER JOIN user_webhooks uw ON dl.endpoint_id = uw.id
        WHERE 1=1
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM user_webhook_delivery_logs dl
        INNER JOIN user_webhooks uw ON dl.endpoint_id = uw.id
        WHERE 1=1
      `;
    }

    const params = [];
    const countParams = [];

    if (needsResellerJoin) {
      params.push(resellerId);
      countParams.push(resellerId);
    }

    if (userId) {
      sql += ' AND uw.user_id = ?';
      countSql += ' AND uw.user_id = ?';
      params.push(userId);
      countParams.push(userId);

      // If reseller specified a userId, verify merchant belongs to reseller
      if (resellerId) {
        sql += ' AND EXISTS (SELECT 1 FROM reseller_merchant_relationships WHERE reseller_id = ? AND merchant_id = uw.user_id)';
        countSql += ' AND EXISTS (SELECT 1 FROM reseller_merchant_relationships WHERE reseller_id = ? AND merchant_id = uw.user_id)';
        params.push(resellerId);
        countParams.push(resellerId);
      }
    }

    if (status) {
      sql += ' AND dl.status = ?';
      countSql += ' AND dl.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (eventType) {
      sql += ' AND dl.event_type = ?';
      countSql += ' AND dl.event_type = ?';
      params.push(eventType);
      countParams.push(eventType);
    }

    if (dateFrom) {
      sql += ' AND dl.created_at >= ?';
      countSql += ' AND dl.created_at >= ?';
      params.push(dateFrom);
      countParams.push(dateFrom);
    }

    if (dateTo) {
      sql += ' AND dl.created_at <= ?';
      countSql += ' AND dl.created_at <= ?';
      params.push(dateTo);
      countParams.push(dateTo);
    }

    if (domainId) {
      sql += ' AND dl.domain_id = ?';
      countSql += ' AND dl.domain_id = ?';
      params.push(domainId);
      countParams.push(domainId);
    }

    sql += ' ORDER BY dl.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [results, countResult] = await Promise.all([
      query(sql, params),
      queryOne(countSql, countParams)
    ]);

    return {
      logs: results.map(r => this.parseDeliveryLog(r)),
      total: countResult.total,
      page: pageNum,
      limit: limitNum
    };
  },

  async findPendingRetries() {
    const sql = `
      SELECT * FROM user_webhook_delivery_logs
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
