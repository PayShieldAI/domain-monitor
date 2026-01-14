const domainRepository = require('../repositories/domainRepository');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { buildPaginationResponse } = require('../utils/pagination');

const domainService = {
  async addDomain(userId, domain, checkFrequency) {
    // Check if domain already exists for this user
    const existing = await domainRepository.findByDomainAndUserId(domain, userId);
    if (existing) {
      throw new AppError('Domain already being monitored', 409, 'DOMAIN_EXISTS');
    }

    const newDomain = await domainRepository.create({
      userId,
      domain,
      checkFrequency
    });

    logger.info({ userId, domainId: newDomain.id, domain }, 'Domain added');

    // TODO: Trigger initial domain check via provider service
    // await providerService.checkDomain(newDomain);

    return this.formatDomainResponse(newDomain);
  },

  async addDomainsBulk(userId, domains) {
    const results = await domainRepository.bulkCreate(userId, domains);

    logger.info({
      userId,
      successCount: results.success.length,
      failedCount: results.failed.length
    }, 'Bulk domains added');

    return {
      success: results.success.map(d => this.formatDomainResponse(d)),
      failed: results.failed,
      total: domains.length,
      successCount: results.success.length,
      failedCount: results.failed.length
    };
  },

  async getDomain(userId, domainId) {
    const domain = await domainRepository.findByIdAndUserId(domainId, userId);
    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    return this.formatDomainResponse(domain);
  },

  async getDomainDetails(userId, domainId) {
    const domain = await domainRepository.findByIdAndUserId(domainId, userId);
    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    return this.formatDomainDetailResponse(domain);
  },

  async getDomainsBulk(userId, ids) {
    const domains = await domainRepository.findByIds(ids, userId);
    const foundIds = domains.map(d => d.id);
    const notFound = ids.filter(id => !foundIds.includes(id));

    return {
      domains: domains.map(d => this.formatDomainResponse(d)),
      notFound
    };
  },

  async listDomains(userId, options) {
    const { domains, total } = await domainRepository.findByUserId(userId, options);

    return {
      data: domains.map(d => this.formatDomainResponse(d)),
      pagination: buildPaginationResponse(options.page, options.limit, total),
      filters: {
        status: options.status || null,
        recommendation: options.recommendation || null,
        search: options.search || null
      }
    };
  },

  async stopMonitoring(userId, domainId) {
    const domain = await domainRepository.findByIdAndUserId(domainId, userId);
    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    const updated = await domainRepository.updateStatus(domainId, 'inactive');
    logger.info({ userId, domainId }, 'Domain monitoring stopped');

    return this.formatDomainResponse(updated);
  },

  async stopMonitoringBulk(userId, ids) {
    const result = await domainRepository.bulkUpdateStatus(ids, userId, 'inactive');

    logger.info({
      userId,
      updatedCount: result.updated.length,
      notFoundCount: result.notFound.length
    }, 'Bulk domain monitoring stopped');

    return {
      updated: result.updated,
      notFound: result.notFound,
      message: `Monitoring stopped for ${result.updated.length} domain(s)`
    };
  },

  async startMonitoring(userId, domainId) {
    const domain = await domainRepository.findByIdAndUserId(domainId, userId);
    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    const updated = await domainRepository.restartMonitoring(domainId);
    logger.info({ userId, domainId }, 'Domain monitoring restarted');

    // TODO: Trigger domain check
    // await providerService.checkDomain(updated);

    return this.formatDomainResponse(updated);
  },

  async startMonitoringBulk(userId, ids) {
    const result = await domainRepository.bulkUpdateStatus(ids, userId, 'active');

    // Update next_check_at for all restarted domains
    for (const id of result.updated) {
      await domainRepository.restartMonitoring(id);
    }

    logger.info({
      userId,
      updatedCount: result.updated.length,
      notFoundCount: result.notFound.length
    }, 'Bulk domain monitoring restarted');

    return {
      updated: result.updated,
      notFound: result.notFound,
      message: `Monitoring restarted for ${result.updated.length} domain(s)`
    };
  },

  async getCheckHistory(userId, domainId, limit = 10) {
    const domain = await domainRepository.findByIdAndUserId(domainId, userId);
    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    const history = await domainRepository.getCheckHistory(domainId, limit);
    return history.map(h => ({
      id: h.id,
      recommendation: h.recommendation,
      provider: h.provider,
      checkedAt: h.checked_at
    }));
  },

  formatDomainResponse(domain) {
    return {
      id: domain.id,
      domain: domain.domain,
      name: domain.name,
      status: domain.status,
      recommendation: domain.recommendation,
      industry: domain.industry,
      businessType: domain.business_type,
      foundedYear: domain.founded_year,
      provider: domain.provider,
      checkFrequency: domain.check_frequency,
      lastCheckedAt: domain.last_checked_at,
      nextCheckAt: domain.next_check_at,
      createdAt: domain.created_at,
      updatedAt: domain.updated_at
    };
  },

  formatDomainDetailResponse(domain) {
    return {
      ...this.formatDomainResponse(domain),
      rawData: domain.raw_data ? JSON.parse(domain.raw_data) : null,
      providerResponseId: domain.provider_response_id
    };
  }
};

module.exports = domainService;
