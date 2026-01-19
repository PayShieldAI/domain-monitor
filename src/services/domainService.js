const domainRepository = require('../repositories/domainRepository');
const providerService = require('./providerService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { buildPaginationResponse } = require('../utils/pagination');
const { isSuperadmin, isReseller, isMerchant } = require('../middlewares/auth');

const domainService = {
  async addDomain(userId, domainData) {
    const {
      domain,
      name,
      description,
      website,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
      email,
      phone,
      fullName,
      externalTrackingRef,
      checkFrequency
    } = domainData;

    // Check if domain already exists for this user (only if domain provided)
    if (domain) {
      const existing = await domainRepository.findByDomainAndUserId(domain, userId);
      if (existing) {
        throw new AppError('Domain already being monitored', 409, 'DOMAIN_EXISTS');
      }
    }

    const newDomain = await domainRepository.create({
      userId,
      domain,
      name,
      checkFrequency
    });

    logger.info({ userId, domainId: newDomain.id, domain, name }, 'Domain added');

    // Build provider request payload with all submitted fields
    const providerPayload = {
      domain,
      name,
      description,
      website,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
      email,
      phone,
      fullName,
      externalTrackingRef
    };

    // Trigger initial domain check and optionally start monitoring (async, don't wait)
    (async () => {
      try {
        // First, do the initial web presence review with all submitted fields
        await providerService.checkDomain(newDomain.id, providerPayload);
        logger.info({ domainId: newDomain.id, domain, name }, 'Initial domain check completed');

        // Only start monitoring if:
        // 1. checkFrequency is provided (not null/empty) - user wants ongoing monitoring
        // 2. domain is provided - monitoring requires a domain, cannot monitor by business name only
        if (checkFrequency && domain) {
          await providerService.startMonitoring(newDomain.id, domain);
          logger.info({ domainId: newDomain.id, domain, checkFrequency }, 'Domain monitoring started with provider');
        } else if (!checkFrequency) {
          logger.info({ domainId: newDomain.id, domain, name }, 'Skipping monitoring - no checkFrequency provided (one-time check only)');
        } else {
          logger.info({ domainId: newDomain.id, name }, 'Skipping monitoring - no domain provided (business name only)');
        }
      } catch (err) {
        logger.error({ domainId: newDomain.id, error: err.message }, 'Initial domain check failed');
      }
    })();

    return this.formatDomainResponse(newDomain);
  },

  async addDomainsBulk(userId, domains) {
    const results = await domainRepository.bulkCreate(userId, domains);

    logger.info({
      userId,
      successCount: results.success.length,
      failedCount: results.failed.length
    }, 'Bulk domains added');

    // Trigger provider checks for all successfully created domains
    const providerResults = {
      checked: [],
      checkFailed: []
    };

    for (const domainRecord of results.success) {
      try {
        const identifier = domainRecord.domain || domainRecord.name;
        logger.info({
          userId,
          domainId: domainRecord.id,
          domain: domainRecord.domain,
          name: domainRecord.name
        }, 'Triggering provider check for bulk domain');

        // Build provider payload from original item data
        const originalItem = domainRecord._originalItem || {};
        const providerPayload = {
          domain: originalItem.domain,
          name: originalItem.name,
          description: originalItem.description,
          website: originalItem.website,
          addressLine1: originalItem.addressLine1,
          addressLine2: originalItem.addressLine2,
          city: originalItem.city,
          stateProvince: originalItem.stateProvince,
          postalCode: originalItem.postalCode,
          country: originalItem.country,
          email: originalItem.email,
          phone: originalItem.phone,
          fullName: originalItem.fullName,
          externalTrackingRef: originalItem.externalTrackingRef
        };

        // Do initial web presence review with all fields
        await providerService.checkDomain(domainRecord.id, providerPayload);

        // Start monitoring with provider only if:
        // 1. checkFrequency is provided (not null/empty) - user wants ongoing monitoring
        // 2. domain is provided - monitoring requires a domain, cannot monitor by business name only
        const itemCheckFrequency = originalItem.checkFrequency;
        if (itemCheckFrequency && domainRecord.domain) {
          await providerService.startMonitoring(domainRecord.id, domainRecord.domain);
          providerResults.checked.push({
            domainId: domainRecord.id,
            domain: domainRecord.domain,
            status: 'checked_and_monitoring'
          });
        } else {
          let reason = 'one-time check only';
          if (!itemCheckFrequency) {
            reason = 'no checkFrequency provided (one-time check only)';
          } else if (!domainRecord.domain) {
            reason = 'no domain provided (business name only)';
          }
          providerResults.checked.push({
            domainId: domainRecord.id,
            domain: domainRecord.domain,
            name: domainRecord.name,
            status: 'checked_only'
          });
          logger.info({
            domainId: domainRecord.id,
            domain: domainRecord.domain,
            name: domainRecord.name,
            reason
          }, 'Skipping monitoring for bulk domain');
        }

        logger.info({
          userId,
          domainId: domainRecord.id,
          domain: identifier
        }, 'Provider check and monitoring started for bulk domain');

      } catch (error) {
        const identifier = domainRecord.domain || domainRecord.name;
        providerResults.checkFailed.push({
          domainId: domainRecord.id,
          domain: identifier,
          error: error.message
        });

        logger.error({
          userId,
          domainId: domainRecord.id,
          domain: identifier,
          error: error.message
        }, 'Provider check failed for bulk domain');
      }
    }

    logger.info({
      userId,
      totalDomains: domains.length,
      successfullyCreated: results.success.length,
      failedToCreate: results.failed.length,
      providerChecked: providerResults.checked.length,
      providerCheckFailed: providerResults.checkFailed.length
    }, 'Bulk domain creation and provider checks completed');

    return {
      success: results.success.map(d => this.formatDomainResponse(d)),
      failed: results.failed,
      total: domains.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      providerChecks: {
        checked: providerResults.checked.length,
        failed: providerResults.checkFailed.length,
        failures: providerResults.checkFailed
      }
    };
  },

  async getDomain(user, domainId) {
    let domain;

    if (isSuperadmin(user)) {
      // Superadmin can access any domain
      domain = await domainRepository.findById(domainId);
    } else if (isReseller(user)) {
      // Reseller can only access domains of assigned merchants
      const hasAccess = await domainRepository.resellerHasAccessToDomain(user.id, domainId);
      if (!hasAccess) {
        throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
      }
      domain = await domainRepository.findById(domainId);
    } else {
      // Merchant can only access own domains
      domain = await domainRepository.findByIdAndUserId(domainId, user.id);
    }

    if (!domain) {
      throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
    }

    return this.formatDomainResponse(domain);
  },

  async getDomainDetails(user, domainId) {
    let domain;

    if (isSuperadmin(user)) {
      // Superadmin can access any domain
      domain = await domainRepository.findById(domainId);
    } else if (isReseller(user)) {
      // Reseller can only access domains of assigned merchants
      const hasAccess = await domainRepository.resellerHasAccessToDomain(user.id, domainId);
      if (!hasAccess) {
        throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
      }
      domain = await domainRepository.findById(domainId);
    } else {
      // Merchant can only access own domains
      domain = await domainRepository.findByIdAndUserId(domainId, user.id);
    }

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

  async listDomains(user, options) {
    let result;

    if (isSuperadmin(user)) {
      // Superadmin can see all domains
      result = await domainRepository.findAll(options);
    } else if (isReseller(user)) {
      // Reseller can see domains of assigned merchants
      result = await domainRepository.findByResellerId(user.id, options);
    } else {
      // Merchant can only see own domains
      result = await domainRepository.findByUserId(user.id, options);
    }

    return {
      data: result.domains.map(d => this.formatDomainResponse(d)),
      pagination: buildPaginationResponse(options.page, options.limit, result.total),
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

    // Stop provider monitoring (async, don't wait)
    (async () => {
      try {
        await providerService.stopMonitoring(domainId, domain.domain);
        logger.info({ domainId, domain: domain.domain }, 'Provider monitoring stopped');
      } catch (err) {
        logger.error({ domainId, error: err.message }, 'Failed to stop provider monitoring');
      }
    })();

    return this.formatDomainResponse(updated);
  },

  async stopMonitoringBulk(userId, ids) {
    // First get the domains to have access to domain names for provider calls
    const domains = await domainRepository.findByIds(ids, userId);
    const domainMap = new Map(domains.map(d => [d.id, d.domain]));

    const result = await domainRepository.bulkUpdateStatus(ids, userId, 'inactive');

    logger.info({
      userId,
      updatedCount: result.updated.length,
      notFoundCount: result.notFound.length
    }, 'Bulk domain monitoring stopped');

    // Stop provider monitoring for all updated domains (async, don't wait)
    (async () => {
      for (const domainId of result.updated) {
        const domainName = domainMap.get(domainId);
        if (domainName) {
          try {
            await providerService.stopMonitoring(domainId, domainName);
            logger.info({ domainId, domain: domainName }, 'Provider monitoring stopped');
          } catch (err) {
            logger.error({ domainId, error: err.message }, 'Failed to stop provider monitoring');
          }
        }
      }
    })();

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

    // Trigger domain check and start provider monitoring (async)
    (async () => {
      try {
        await providerService.checkDomain(domainId, domain.domain);
        await providerService.startMonitoring(domainId, domain.domain);
        logger.info({ domainId, domain: domain.domain }, 'Provider monitoring started');
      } catch (err) {
        logger.error({ domainId, error: err.message }, 'Failed to start provider monitoring');
      }
    })();

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
