const webhookRepository = require('../repositories/webhookRepository');
const AppError = require('../utils/AppError');

const webhookService = {
  /**
   * List webhook events with filtering
   * @param {Object} filters - Filter parameters
   * @param {string} filters.provider - Filter by provider name
   * @param {string} filters.domainId - Filter by domain ID
   * @param {boolean} filters.status - Filter by processed status
   * @param {string} filters.dateFrom - Filter by start date (ISO 8601)
   * @param {string} filters.dateTo - Filter by end date (ISO 8601)
   * @param {number} filters.limit - Max results per page
   * @param {number} filters.offset - Pagination offset
   * @returns {Promise<Object>} List of webhooks with pagination metadata
   */
  async listWebhooks(filters = {}) {
    const {
      provider,
      domainId,
      status,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0
    } = filters;

    // Validate limit bounds
    const sanitizedLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const sanitizedOffset = Math.max(0, parseInt(offset) || 0);

    // Build filter object for repository
    const repoFilters = {
      limit: sanitizedLimit,
      offset: sanitizedOffset
    };

    if (provider) {
      repoFilters.provider = provider;
    }

    if (domainId) {
      repoFilters.domainId = domainId;
    }

    if (status !== undefined && status !== null) {
      repoFilters.status = status;
    }

    if (dateFrom) {
      repoFilters.dateFrom = dateFrom;
    }

    if (dateTo) {
      repoFilters.dateTo = dateTo;
    }

    // Fetch webhooks and total count
    const [webhooks, total] = await Promise.all([
      webhookRepository.findWithFilters(repoFilters),
      webhookRepository.countWithFilters(repoFilters)
    ]);

    return {
      webhooks,
      pagination: {
        total,
        limit: sanitizedLimit,
        offset: sanitizedOffset,
        page: Math.floor(sanitizedOffset / sanitizedLimit) + 1,
        totalPages: Math.ceil(total / sanitizedLimit)
      }
    };
  }
};

module.exports = webhookService;
