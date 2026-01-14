const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const domainRepository = {
  async create({ userId, domain, checkFrequency = 'daily' }) {
    const id = uuid();
    const nextCheckAt = this.calculateNextCheck(checkFrequency);

    const sql = `
      INSERT INTO domains (id, user_id, domain, check_frequency, status, next_check_at, created_at)
      VALUES (?, ?, ?, ?, 'active', ?, NOW())
    `;
    await query(sql, [id, userId, domain, checkFrequency, nextCheckAt]);
    return this.findById(id);
  },

  async bulkCreate(userId, domains) {
    const results = { success: [], failed: [] };

    for (const item of domains) {
      try {
        const domain = await this.create({
          userId,
          domain: item.domain,
          checkFrequency: item.checkFrequency || 'daily'
        });
        results.success.push(domain);
      } catch (err) {
        results.failed.push({
          domain: item.domain,
          error: err.code === 'ER_DUP_ENTRY' ? 'Domain already exists' : err.message
        });
      }
    }

    return results;
  },

  async findById(id) {
    const sql = 'SELECT * FROM domains WHERE id = ?';
    return queryOne(sql, [id]);
  },

  async findByIdAndUserId(id, userId) {
    const sql = 'SELECT * FROM domains WHERE id = ? AND user_id = ?';
    return queryOne(sql, [id, userId]);
  },

  async findByDomainAndUserId(domain, userId) {
    const sql = 'SELECT * FROM domains WHERE domain = ? AND user_id = ?';
    return queryOne(sql, [domain, userId]);
  },

  async findByUserId(userId, { page = 1, limit = 20, status, recommendation, search, sortBy = 'created_at', sortOrder = 'desc' }) {
    let sql = 'SELECT * FROM domains WHERE user_id = ?';
    let countSql = 'SELECT COUNT(*) as total FROM domains WHERE user_id = ?';
    const params = [userId];
    const countParams = [userId];

    if (status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (recommendation) {
      sql += ' AND recommendation = ?';
      countSql += ' AND recommendation = ?';
      params.push(recommendation);
      countParams.push(recommendation);
    }

    if (search) {
      sql += ' AND (domain LIKE ? OR name LIKE ?)';
      countSql += ' AND (domain LIKE ? OR name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    // Validate sortBy to prevent SQL injection
    const allowedSortColumns = ['created_at', 'updated_at', 'domain', 'name', 'recommendation', 'last_checked_at'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${sortColumn} ${order}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const [domains, countResult] = await Promise.all([
      query(sql, params),
      queryOne(countSql, countParams)
    ]);

    return {
      domains,
      total: countResult.total
    };
  },

  async findByIds(ids, userId) {
    if (!ids || ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM domains WHERE id IN (${placeholders}) AND user_id = ?`;
    return query(sql, [...ids, userId]);
  },

  async updateWithCheckResult(id, result) {
    const sql = `
      UPDATE domains
      SET recommendation = ?,
          industry = ?,
          business_type = ?,
          founded_year = ?,
          name = ?,
          raw_data = ?,
          provider = ?,
          provider_response_id = ?,
          last_checked_at = NOW(),
          next_check_at = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    const domain = await this.findById(id);
    const nextCheckAt = this.calculateNextCheck(domain.check_frequency);

    await query(sql, [
      result.recommendation,
      result.industry,
      result.businessType,
      result.foundedYear,
      result.name,
      JSON.stringify(result.rawData),
      result.provider,
      result.providerResponseId,
      nextCheckAt,
      id
    ]);

    return this.findById(id);
  },

  async updateStatus(id, status) {
    const sql = 'UPDATE domains SET status = ?, updated_at = NOW() WHERE id = ?';
    await query(sql, [status, id]);
    return this.findById(id);
  },

  async bulkUpdateStatus(ids, userId, status) {
    if (!ids || ids.length === 0) return { updated: [], notFound: [] };

    // First, find which domains exist and belong to the user
    const existing = await this.findByIds(ids, userId);
    const existingIds = existing.map(d => d.id);
    const notFoundIds = ids.filter(id => !existingIds.includes(id));

    if (existingIds.length > 0) {
      const placeholders = existingIds.map(() => '?').join(',');
      const sql = `UPDATE domains SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`;
      await query(sql, [status, ...existingIds]);
    }

    return {
      updated: existingIds,
      notFound: notFoundIds
    };
  },

  async restartMonitoring(id) {
    const domain = await this.findById(id);
    if (!domain) return null;

    const nextCheckAt = this.calculateNextCheck(domain.check_frequency);
    const sql = `
      UPDATE domains
      SET status = 'active',
          next_check_at = ?,
          updated_at = NOW()
      WHERE id = ?
    `;
    await query(sql, [nextCheckAt, id]);
    return this.findById(id);
  },

  async delete(id) {
    const sql = 'DELETE FROM domains WHERE id = ?';
    await query(sql, [id]);
  },

  calculateNextCheck(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  },

  // Domain Check History
  async createCheckHistory({ domainId, recommendation, provider, rawData }) {
    const id = uuid();
    const sql = `
      INSERT INTO domain_check_history (id, domain_id, recommendation, provider, raw_data, checked_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    await query(sql, [id, domainId, recommendation, provider, JSON.stringify(rawData)]);
    return id;
  },

  async getCheckHistory(domainId, limit = 10) {
    const sql = `
      SELECT * FROM domain_check_history
      WHERE domain_id = ?
      ORDER BY checked_at DESC
      LIMIT ?
    `;
    return query(sql, [domainId, limit]);
  }
};

module.exports = domainRepository;
