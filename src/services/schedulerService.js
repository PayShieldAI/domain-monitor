const domainRepository = require('../repositories/domainRepository');
const providerService = require('./providerService');
const logger = require('../utils/logger');

/**
 * Scheduler Service
 * Handles periodic domain checks based on check_frequency
 */
class SchedulerService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.checkIntervalMs = 60 * 1000; // Check every 1 minute for due domains
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    // Initialize provider service
    await providerService.initialize();

    this.isRunning = true;
    logger.info('Scheduler started');

    // Run immediately
    await this.checkDueDomains();

    // Then run periodically
    this.intervalId = setInterval(async () => {
      await this.checkDueDomains();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Scheduler stopped');
  }

  /**
   * Check all domains that are due for checking
   */
  async checkDueDomains() {
    try {
      const { query } = require('../config/database');

      // Find all active domains where next_check_at <= NOW()
      const sql = `
        SELECT id, domain, user_id, check_frequency
        FROM domains
        WHERE status = 'active'
          AND next_check_at <= NOW()
        ORDER BY next_check_at ASC
        LIMIT 50
      `;

      const dueDomains = await query(sql);

      if (dueDomains.length === 0) {
        logger.debug('No domains due for checking');
        return;
      }

      logger.info({ count: dueDomains.length }, 'Found domains due for checking');

      // Process domains sequentially to respect rate limits
      for (const domain of dueDomains) {
        try {
          await this.checkSingleDomain(domain);
        } catch (error) {
          logger.error({
            domainId: domain.id,
            domain: domain.domain,
            error: error.message
          }, 'Failed to check domain');
        }
      }

      logger.info({ count: dueDomains.length }, 'Completed checking due domains');

    } catch (error) {
      logger.error({ error: error.message }, 'Error in checkDueDomains');
    }
  }

  /**
   * Check a single domain
   * @param {Object} domain - Domain record
   */
  async checkSingleDomain(domain) {
    logger.info({
      domainId: domain.id,
      domain: domain.domain
    }, 'Checking domain');

    try {
      await providerService.checkDomain(domain.id, domain.domain);

      logger.info({
        domainId: domain.id,
        domain: domain.domain
      }, 'Domain check successful');

    } catch (error) {
      logger.error({
        domainId: domain.id,
        domain: domain.domain,
        error: error.message
      }, 'Domain check failed');

      // Still update next_check_at even if check failed
      const nextCheckAt = this.calculateNextCheck(domain.check_frequency);
      const { query: dbQuery } = require('../config/database');
      await dbQuery(
        'UPDATE domains SET next_check_at = ? WHERE id = ?',
        [nextCheckAt, domain.id]
      );

      throw error;
    }
  }

  /**
   * Calculate next check time based on frequency
   * @param {string} frequency - 7 | 30 | 90 (days)
   * @returns {Date}
   */
  calculateNextCheck(frequency) {
    const now = new Date();
    const days = parseInt(frequency, 10);

    // Validate frequency
    if (!days || ![7, 30, 90].includes(days)) {
      logger.warn({ frequency }, 'Invalid check frequency, defaulting to 7 days');
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Manually trigger check for a specific domain
   * @param {string} domainId - Domain ID
   */
  async triggerDomainCheck(domainId) {
    const domain = await domainRepository.findById(domainId);
    if (!domain) {
      throw new Error('Domain not found');
    }

    logger.info({ domainId, domain: domain.domain }, 'Manual domain check triggered');

    return await this.checkSingleDomain(domain);
  }

  /**
   * Get scheduler status
   * @returns {Object}
   */
  getStatus() {
    return {
      running: this.isRunning,
      checkIntervalMs: this.checkIntervalMs
    };
  }
}

// Export singleton instance
module.exports = new SchedulerService();
