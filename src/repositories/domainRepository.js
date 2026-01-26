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

  /**
   * Find domains with filtering, pagination and sorting
   * @param {string} mode - 'all' (superadmin), 'user' (merchant), 'reseller'
   * @param {string|null} id - userId or resellerId (null for 'all' mode)
   * @param {object} options - filter and pagination options
   */
  async findDomains(mode, id, options = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      recommendation,
      search,
      industry,
      businessType,
      foundedYear,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    // Build base query based on mode
    let sql, countSql, prefix;
    const params = [];
    const countParams = [];

    if (mode === 'all') {
      sql = 'SELECT * FROM domains WHERE 1=1';
      countSql = 'SELECT COUNT(*) as total FROM domains WHERE 1=1';
      prefix = '';
    } else if (mode === 'reseller') {
      sql = `
        SELECT d.* FROM domains d
        INNER JOIN reseller_merchant_relationships rmr ON d.user_id = rmr.merchant_id
        WHERE rmr.reseller_id = ?
      `;
      countSql = `
        SELECT COUNT(*) as total FROM domains d
        INNER JOIN reseller_merchant_relationships rmr ON d.user_id = rmr.merchant_id
        WHERE rmr.reseller_id = ?
      `;
      prefix = 'd.';
      params.push(id);
      countParams.push(id);
    } else {
      // mode === 'user'
      sql = 'SELECT * FROM domains WHERE user_id = ?';
      countSql = 'SELECT COUNT(*) as total FROM domains WHERE user_id = ?';
      prefix = '';
      params.push(id);
      countParams.push(id);
    }

    // Apply filters
    if (status) {
      sql += ` AND ${prefix}status = ?`;
      countSql += ` AND ${prefix}status = ?`;
      params.push(status);
      countParams.push(status);
    }

    if (recommendation) {
      sql += ` AND ${prefix}recommendation = ?`;
      countSql += ` AND ${prefix}recommendation = ?`;
      params.push(recommendation);
      countParams.push(recommendation);
    }

    if (search) {
      sql += ` AND (${prefix}domain LIKE ? OR ${prefix}name LIKE ?)`;
      countSql += ` AND (${prefix}domain LIKE ? OR ${prefix}name LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    if (industry) {
      sql += ` AND ${prefix}industry LIKE ?`;
      countSql += ` AND ${prefix}industry LIKE ?`;
      const industryPattern = `%${industry}%`;
      params.push(industryPattern);
      countParams.push(industryPattern);
    }

    if (businessType) {
      sql += ` AND ${prefix}business_type LIKE ?`;
      countSql += ` AND ${prefix}business_type LIKE ?`;
      const businessTypePattern = `%${businessType}%`;
      params.push(businessTypePattern);
      countParams.push(businessTypePattern);
    }

    if (foundedYear) {
      sql += ` AND ${prefix}founded_year = ?`;
      countSql += ` AND ${prefix}founded_year = ?`;
      params.push(parseInt(foundedYear, 10));
      countParams.push(parseInt(foundedYear, 10));
    }

    // Apply sorting
    const allowedSortColumns = ['created_at', 'updated_at', 'domain', 'name', 'recommendation', 'last_checked_at', 'industry', 'business_type', 'founded_year'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${prefix}${sortColumn} ${order}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitNum, (pageNum - 1) * limitNum);

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

  // Convenience methods that use findDomains
  async findByUserId(userId, options = {}) {
    return this.findDomains('user', userId, options);
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

  // Multi-tenant access methods

  async findByResellerId(resellerId, options = {}) {
    return this.findDomains('reseller', resellerId, options);
  },

  async findAll(options = {}) {
    return this.findDomains('all', null, options);
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
