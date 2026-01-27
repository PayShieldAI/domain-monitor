const { v4: uuid } = require('uuid');
const { query, queryOne } = require('../config/database');

const domainSubmissionRepository = {
  /**
   * Create a domain submission record
   * @param {Object} data - Submission data
   * @returns {Promise<Object>} Created submission
   */
  async create(data) {
    const id = uuid();
    const {
      domainId,
      // Submitted data
      submittedDomainName,
      submittedBusinessName,
      submittedDescription,
      submittedWebsite,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
      submittedEmail,
      submittedPhone,
      submittedFullName
    } = data;

    const sql = `
      INSERT INTO domain_submissions (
        id, domain_id, submitted_domain_name,
        submitted_business_name, submitted_description, submitted_website,
        address_line_1, address_line_2, city, state_province, postal_code, country,
        submitted_email, submitted_phone, submitted_full_name,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await query(sql, [
      id, domainId,
      submittedDomainName || null,
      submittedBusinessName || null,
      submittedDescription || null,
      submittedWebsite || null,
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      stateProvince || null,
      postalCode || null,
      country || null,
      submittedEmail || null,
      submittedPhone || null,
      submittedFullName || null
    ]);

    return this.findById(id);
  },

  /**
   * Find submission by ID
   * @param {string} id - Submission ID
   * @returns {Promise<Object|null>} Submission or null
   */
  async findById(id) {
    const sql = 'SELECT * FROM domain_submissions WHERE id = ?';
    return queryOne(sql, [id]);
  },

  /**
   * Find submission by domain ID
   * @param {string} domainId - Domain ID
   * @returns {Promise<Object|null>} Submission or null
   */
  async findByDomainId(domainId) {
    const sql = 'SELECT * FROM domain_submissions WHERE domain_id = ? ORDER BY created_at DESC LIMIT 1';
    return queryOne(sql, [domainId]);
  },

  /**
   * Delete submission by domain ID
   * @param {string} domainId - Domain ID
   * @returns {Promise<void>}
   */
  async deleteByDomainId(domainId) {
    const sql = 'DELETE FROM domain_submissions WHERE domain_id = ?';
    await query(sql, [domainId]);
  }
};

module.exports = domainSubmissionRepository;
