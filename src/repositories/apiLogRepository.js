const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const apiLogRepository = {
  async create({
    userId = null,
    method,
    path,
    queryParams = null,
    headers = null,
    requestBody = null,
    responseStatus,
    responseBody = null,
    durationMs,
    ipAddress = null,
    userAgent = null,
    errorMessage = null
  }) {
    const id = uuid();
    const sql = `
      INSERT INTO api_logs (
        id, user_id, method, path, query_params, headers,
        request_body, response_status, response_body, duration_ms,
        ip_address, user_agent, error_message, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await query(sql, [
      id,
      userId,
      method,
      path,
      queryParams ? JSON.stringify(queryParams) : null,
      headers ? JSON.stringify(headers) : null,
      requestBody ? JSON.stringify(requestBody) : null,
      responseStatus,
      responseBody ? JSON.stringify(responseBody) : null,
      durationMs,
      ipAddress,
      userAgent,
      errorMessage
    ]);

    return id;
  },

  async findById(id) {
    const sql = 'SELECT * FROM api_logs WHERE id = ?';
    return queryOne(sql, [id]);
  },

  async findByUserId(userId, { limit = 50, offset = 0 } = {}) {
    const sql = `
      SELECT * FROM api_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return query(sql, [userId, limit, offset]);
  },

  async findRecent({ limit = 100, offset = 0 } = {}) {
    const sql = `
      SELECT * FROM api_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return query(sql, [limit, offset]);
  },

  async findByPath(path, { limit = 50, offset = 0 } = {}) {
    const sql = `
      SELECT * FROM api_logs
      WHERE path = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return query(sql, [path, limit, offset]);
  },

  async findByStatus(status, { limit = 50, offset = 0 } = {}) {
    const sql = `
      SELECT * FROM api_logs
      WHERE response_status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return query(sql, [status, limit, offset]);
  },

  async findErrors({ limit = 50, offset = 0 } = {}) {
    const sql = `
      SELECT * FROM api_logs
      WHERE response_status >= 400
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return query(sql, [limit, offset]);
  },

  async deleteOlderThan(days) {
    const sql = `
      DELETE FROM api_logs
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const result = await query(sql, [days]);
    return result.affectedRows;
  },

  async getStats(startDate = null, endDate = null) {
    let sql = `
      SELECT
        COUNT(*) as total_requests,
        AVG(duration_ms) as avg_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        SUM(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) as error_count
      FROM api_logs
    `;

    const params = [];
    if (startDate && endDate) {
      sql += ' WHERE created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += ' WHERE created_at >= ?';
      params.push(startDate);
    }

    return queryOne(sql, params);
  }
};

module.exports = apiLogRepository;
