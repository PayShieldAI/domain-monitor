const { query, queryOne } = require('../config/database');
const { v4: uuid } = require('uuid');

/**
 * Calculate next check date based on frequency
 * @param {string|number} checkFrequency - Check frequency in days (e.g., '7', '30', '90')
 * @returns {Date} Next check date
 */
function calculateNextCheckAt(checkFrequency) {
  const days = parseInt(checkFrequency, 10) || 7; // Default to 7 days
  const nextCheck = new Date();
  nextCheck.setDate(nextCheck.getDate() + days);
  return nextCheck;
}

const domainMonitoringRepository = {
  /**
   * Create monitoring record
   * @param {Object} data - Monitoring data
   * @param {string} data.domainId - Domain ID
   * @param {string} data.checkFrequency - Check frequency in days (7, 30, 90)
   * @param {Array<string>} data.events - Events to monitor (optional)
   * @param {number} data.status - Status (0=inactive, 1=active), default 1
   * @returns {Promise<Object>} Created monitoring record
   */
  async create({ domainId, checkFrequency, events = null, status = 1 }) {
    const id = uuid();
    const nextCheckAt = calculateNextCheckAt(checkFrequency);

    const sql = `
      INSERT INTO domain_monitoring (
        id,
        domain_id,
        check_frequency,
        events,
        status,
        next_check_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        check_frequency = VALUES(check_frequency),
        events = VALUES(events),
        status = VALUES(status),
        next_check_at = VALUES(next_check_at),
        updated_at = NOW()
    `;

    await query(sql, [
      id,
      domainId,
      checkFrequency,
      events ? JSON.stringify(events) : null,
      status,
      nextCheckAt
    ]);

    return this.findByDomainId(domainId);
  },

  /**
   * Find monitoring record by domain ID
   * @param {string} domainId - Domain ID
   * @returns {Promise<Object|null>} Monitoring record or null
   */
  async findByDomainId(domainId) {
    const sql = 'SELECT * FROM domain_monitoring WHERE domain_id = ?';
    return queryOne(sql, [domainId]);
  },

  /**
   * Update monitoring status
   * @param {string} domainId - Domain ID
   * @param {number} status - Status (0=inactive, 1=active)
   * @returns {Promise<Object>} Updated monitoring record
   */
  async updateStatus(domainId, status) {
    const sql = `
      UPDATE domain_monitoring
      SET status = ?,
          updated_at = NOW()
      WHERE domain_id = ?
    `;
    await query(sql, [status, domainId]);
    return this.findByDomainId(domainId);
  },

  /**
   * Update next check time
   * @param {string} domainId - Domain ID
   * @param {string} checkFrequency - Check frequency in days
   * @returns {Promise<Object>} Updated monitoring record
   */
  async updateNextCheckAt(domainId, checkFrequency) {
    const nextCheckAt = calculateNextCheckAt(checkFrequency);

    const sql = `
      UPDATE domain_monitoring
      SET next_check_at = ?,
          updated_at = NOW()
      WHERE domain_id = ?
    `;
    await query(sql, [nextCheckAt, domainId]);
    return this.findByDomainId(domainId);
  },

  /**
   * Update monitoring configuration
   * @param {string} domainId - Domain ID
   * @param {Object} data - Update data
   * @param {string} data.checkFrequency - Check frequency
   * @param {Array<string>} data.events - Events to monitor
   * @param {number} data.status - Status
   * @returns {Promise<Object>} Updated monitoring record
   */
  async update(domainId, { checkFrequency, events, status }) {
    const updates = [];
    const values = [];

    if (checkFrequency !== undefined) {
      updates.push('check_frequency = ?');
      values.push(checkFrequency);
      updates.push('next_check_at = ?');
      values.push(calculateNextCheckAt(checkFrequency));
    }

    if (events !== undefined) {
      updates.push('events = ?');
      values.push(events ? JSON.stringify(events) : null);
    }

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return this.findByDomainId(domainId);
    }

    updates.push('updated_at = NOW()');
    values.push(domainId);

    const sql = `
      UPDATE domain_monitoring
      SET ${updates.join(', ')}
      WHERE domain_id = ?
    `;

    await query(sql, values);
    return this.findByDomainId(domainId);
  },

  /**
   * Delete monitoring record
   * @param {string} domainId - Domain ID
   * @returns {Promise<void>}
   */
  async delete(domainId) {
    const sql = 'DELETE FROM domain_monitoring WHERE domain_id = ?';
    await query(sql, [domainId]);
  },

  /**
   * Get all active monitoring records due for check
   * @returns {Promise<Array>} Monitoring records
   */
  async findDueForCheck() {
    const sql = `
      SELECT dm.*, d.domain, d.user_id
      FROM domain_monitoring dm
      JOIN domains d ON dm.domain_id = d.id
      WHERE dm.status = 1
        AND dm.next_check_at <= NOW()
      ORDER BY dm.next_check_at ASC
    `;
    return query(sql);
  },

  /**
   * Get all active monitoring records
   * @returns {Promise<Array>} Monitoring records
   */
  async findAllActive() {
    const sql = `
      SELECT dm.*, d.domain, d.user_id
      FROM domain_monitoring dm
      JOIN domains d ON dm.domain_id = d.id
      WHERE dm.status = 1
      ORDER BY dm.next_check_at ASC
    `;
    return query(sql);
  }
};

module.exports = domainMonitoringRepository;
