const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');

const providerApiLogRepository = {
  /**
   * Create a provider API log entry
   * @param {Object} logData - Log data
   * @returns {Promise<Object>} Created log entry
   */
  async create(logData) {
    const id = uuidv4();
    const {
      domainId = null,
      provider,
      endpoint,
      method,
      requestPayload = null,
      responseStatus = null,
      responseData = null,
      errorMessage = null,
      requestTimestamp,
      responseTimestamp
    } = logData;

    const sql = `
      INSERT INTO provider_api_logs (
        id, domain_id, provider, endpoint, method,
        request_payload, response_status, response_data,
        error_message, request_timestamp, response_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      id,
      domainId,
      provider,
      endpoint,
      method,
      requestPayload ? JSON.stringify(requestPayload) : null,
      responseStatus,
      responseData ? JSON.stringify(responseData) : null,
      errorMessage,
      requestTimestamp,
      responseTimestamp
    ];

    await db.query(sql, values);

    logger.debug({ logId: id, provider, endpoint }, 'Provider API log created');

    return { id, ...logData };
  },

  /**
   * Find logs by domain ID
   * @param {string} domainId - Domain ID
   * @param {number} limit - Maximum number of logs to return
   * @returns {Promise<Array>} Log entries
   */
  async findByDomainId(domainId, limit = 50) {
    const sql = `
      SELECT * FROM provider_api_logs
      WHERE domain_id = ?
      ORDER BY request_timestamp DESC
      LIMIT ?
    `;

    const [rows] = await db.query(sql, [domainId, limit]);
    return rows;
  },

  /**
   * Find logs by provider
   * @param {string} provider - Provider name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Log entries
   */
  async findByProvider(provider, { limit = 100, offset = 0, startDate = null, endDate = null } = {}) {
    let sql = `
      SELECT * FROM provider_api_logs
      WHERE provider = ?
    `;
    const values = [provider];

    if (startDate) {
      sql += ' AND request_timestamp >= ?';
      values.push(startDate);
    }

    if (endDate) {
      sql += ' AND request_timestamp <= ?';
      values.push(endDate);
    }

    sql += ' ORDER BY request_timestamp DESC LIMIT ? OFFSET ?';
    values.push(limit, offset);

    const [rows] = await db.query(sql, values);
    return rows;
  },

  /**
   * Find failed API calls
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Failed log entries
   */
  async findFailed({ provider = null, limit = 100, startDate = null } = {}) {
    let sql = `
      SELECT * FROM provider_api_logs
      WHERE (response_status IS NULL OR response_status >= 400 OR error_message IS NOT NULL)
    `;
    const values = [];

    if (provider) {
      sql += ' AND provider = ?';
      values.push(provider);
    }

    if (startDate) {
      sql += ' AND request_timestamp >= ?';
      values.push(startDate);
    }

    sql += ' ORDER BY request_timestamp DESC LIMIT ?';
    values.push(limit);

    const [rows] = await db.query(sql, values);
    return rows;
  },

  /**
   * Get API call statistics
   * @param {string} provider - Provider name (optional)
   * @param {string} startDate - Start date for stats
   * @returns {Promise<Object>} Statistics
   */
  async getStats(provider = null, startDate = null) {
    let sql = `
      SELECT
        provider,
        COUNT(*) as total_calls,
        SUM(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN response_status >= 400 OR error_message IS NOT NULL THEN 1 ELSE 0 END) as failed_calls,
        AVG(duration_ms) as avg_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        MAX(duration_ms) as max_duration_ms
      FROM provider_api_logs
      WHERE 1=1
    `;
    const values = [];

    if (provider) {
      sql += ' AND provider = ?';
      values.push(provider);
    }

    if (startDate) {
      sql += ' AND request_timestamp >= ?';
      values.push(startDate);
    }

    sql += ' GROUP BY provider';

    const [rows] = await db.query(sql, values);
    return rows;
  },

  /**
   * Delete old logs (for retention policy)
   * @param {number} daysToKeep - Number of days to keep logs
   * @returns {Promise<number>} Number of deleted rows
   */
  async deleteOldLogs(daysToKeep = 30) {
    const sql = `
      DELETE FROM provider_api_logs
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [result] = await db.query(sql, [daysToKeep]);

    logger.info({ deletedCount: result.affectedRows, daysToKeep }, 'Old provider API logs deleted');

    return result.affectedRows;
  }
};

module.exports = providerApiLogRepository;
