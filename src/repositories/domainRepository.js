const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const domainRepository = {
  async create({ userId, domain, name, checkFrequency = null }) {
    const id = uuid();
    // Only calculate next check if monitoring is enabled (checkFrequency provided)
    const nextCheckAt = checkFrequency ? this.calculateNextCheck(checkFrequency) : null;

    const sql = `
      INSERT INTO domains (id, user_id, domain, name, check_frequency, status, next_check_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, NOW())
    `;
    await query(sql, [id, userId, domain || null, name || null, checkFrequency, nextCheckAt]);
    return this.findById(id);
  },

  async bulkCreate(userId, domains) {
    const results = { success: [], failed: [] };

    for (const item of domains) {
      try {
        const createdDomain = await this.create({
          userId,
          domain: item.domain,
          name: item.name,
          checkFrequency: item.checkFrequency || null
        });
        // Attach original item data for provider calls
        createdDomain._originalItem = item;
        results.success.push(createdDomain);
      } catch (err) {
        results.failed.push({
          domain: item.domain || item.name,
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
    // Ensure page and limit are integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

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
    params.push(limitNum, (pageNum - 1) * limitNum);

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
    // Only calculate next check if monitoring is enabled (check_frequency provided)
    const nextCheckAt = domain.check_frequency ? this.calculateNextCheck(domain.check_frequency) : null;

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
    // Return null if no frequency provided (one-time check only)
    if (!frequency) {
      return null;
    }

    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        // Unknown frequency - return null (no monitoring)
        return null;
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
    const limitNum = parseInt(limit, 10) || 10;
    const sql = `
      SELECT * FROM domain_check_history
      WHERE domain_id = ?
      ORDER BY checked_at DESC
      LIMIT ?
    `;
    return query(sql, [domainId, limitNum]);
  },

  // Multi-tenant access methods

  /**
   * Find domains accessible by a reseller (domains of assigned merchants)
   */
  async findByResellerId(resellerId, { page = 1, limit = 20, status, recommendation, search, sortBy = 'created_at', sortOrder = 'desc' }) {
    // Ensure page and limit are integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    let sql = `
      SELECT d.* FROM domains d
      INNER JOIN reseller_merchant_relationships rmr ON d.user_id = rmr.merchant_id
      WHERE rmr.reseller_id = ?
    `;
    let countSql = `
      SELECT COUNT(*) as total FROM domains d
      INNER JOIN reseller_merchant_relationships rmr ON d.user_id = rmr.merchant_id
      WHERE rmr.reseller_id = ?
    `;
    const params = [resellerId];
    const countParams = [resellerId];

    if (status) {
      sql += ' AND d.status = ?';
      countSql += ' AND d.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (recommendation) {
      sql += ' AND d.recommendation = ?';
      countSql += ' AND d.recommendation = ?';
      params.push(recommendation);
      countParams.push(recommendation);
    }

    if (search) {
      sql += ' AND (d.domain LIKE ? OR d.name LIKE ?)';
      countSql += ' AND (d.domain LIKE ? OR d.name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    const allowedSortFields = ['created_at', 'domain', 'recommendation', 'last_checked_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    sql += ` ORDER BY d.${safeSortBy} ${safeSortOrder}`;

    const offset = (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [domains, countResult] = await Promise.all([
      query(sql, params),
      queryOne(countSql, countParams)
    ]);

    return {
      domains,
      total: countResult.total,
      page: pageNum,
      limit: limitNum
    };
  },

  /**
   * Find all domains (superadmin access)
   */
  async findAll({ page = 1, limit = 20, status, recommendation, search, sortBy = 'created_at', sortOrder = 'desc' }) {
    // Ensure page and limit are integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    let sql = 'SELECT * FROM domains WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM domains WHERE 1=1';
    const params = [];
    const countParams = [];

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

    const allowedSortFields = ['created_at', 'domain', 'recommendation', 'last_checked_at'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const offset = (pageNum - 1) * limitNum;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const [domains, countResult] = await Promise.all([
      query(sql, params),
      queryOne(countSql, countParams)
    ]);

    return {
      domains,
      total: countResult.total,
      page: pageNum,
      limit: limitNum
    };
  },

  /**
   * Check if a reseller has access to a specific domain
   */
  async resellerHasAccessToDomain(resellerId, domainId) {
    const sql = `
      SELECT 1 FROM domains d
      INNER JOIN reseller_merchant_relationships rmr ON d.user_id = rmr.merchant_id
      WHERE rmr.reseller_id = ? AND d.id = ?
      LIMIT 1
    `;
    const result = await queryOne(sql, [resellerId, domainId]);
    return !!result;
  },

  /**
   * Get merchant IDs accessible by a reseller
   */
  async getMerchantIdsByReseller(resellerId) {
    const sql = 'SELECT merchant_id FROM reseller_merchant_relationships WHERE reseller_id = ?';
    const results = await query(sql, [resellerId]);
    return results.map(r => r.merchant_id);
  }
};

module.exports = domainRepository;
