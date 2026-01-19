const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const BaseProvider = require('./BaseProvider');
const logger = require('../../utils/logger');
const providerApiLogRepository = require('../../repositories/providerApiLogRepository');

/**
 * TrueBiz Web Presence Provider
 * API: https://ae.truebiz.io/api/v1
 */
class TrueBizProvider extends BaseProvider {
  constructor(config) {
    super({
      name: 'truebiz',
      apiBaseUrl: config.apiBaseUrl || 'https://ae.truebiz.io/api/v1',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000, // TrueBiz API can take 15-20+ seconds
      rateLimit: config.rateLimit || 60
    });

    // Log configuration for debugging
    logger.info({
      provider: 'truebiz',
      apiBaseUrl: this.apiBaseUrl,
      timeout: this.timeout
    }, 'TrueBiz provider initialized');

    // Configure axios with retry logic
    // TrueBiz uses X-API-KEY header for authentication (per OpenAPI spec)
    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: this.timeout,
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Retry configuration
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response && error.response.status >= 500);
      }
    });
  }

  /**
   * Check domain using TrueBiz Company Search API
   * @param {string|Object} domainOrPayload - Domain string or full payload object
   * @param {string} domainId - Domain ID for logging (optional)
   * @returns {Promise<Object>} Standardized result
   */
  async checkDomain(domainOrPayload, domainId = null) {
    const endpoint = '/company/search';
    const requestPayload = this.buildRequestPayload(domainOrPayload);
    const requestTimestamp = new Date().toISOString();

    // Log the outgoing request with headers (masked for security)
    const apiKey = this.client.defaults.headers['X-API-KEY'];
    const maskedApiKey = apiKey ? `****${apiKey.slice(-8)}` : 'NOT SET';

    logger.info({
      provider: 'truebiz',
      endpoint,
      fullUrl: `${this.apiBaseUrl}${endpoint}`,
      baseURL: this.client.defaults.baseURL,
      method: 'POST',
      headers: {
        'X-API-KEY': maskedApiKey,
        'Content-Type': this.client.defaults.headers['Content-Type']
      },
      requestPayload,
      requestTimestamp
    }, 'Provider API request');

    // Extract domain for logging
    const domainName = typeof domainOrPayload === 'string' ? domainOrPayload : (domainOrPayload.domain || domainOrPayload.name);

    try {
      const response = await this.client.post(endpoint, requestPayload);
      const responseTimestamp = new Date().toISOString();

      // Log the successful response to console
      logger.info({
        provider: 'truebiz',
        endpoint,
        method: 'POST',
        domain: domainName,
        requestTimestamp,
        responseTimestamp,
        responseStatus: response.status,
        responseData: response.data
      }, 'Provider API response');

      // Log to database
      await this.logApiCall({
        domainId,
        endpoint,
        method: 'POST',
        requestPayload,
        responseStatus: response.status,
        responseData: response.data,
        requestTimestamp,
        responseTimestamp
      });

      const result = this.standardizeResponse(response.data);

      logger.info({
        domain: domainName,
        provider: 'truebiz',
        recommendation: result.recommendation
      }, 'Domain check completed');

      return result;

    } catch (error) {
      const responseTimestamp = new Date().toISOString();

      // Log the error response to console with full details
      logger.error({
        provider: 'truebiz',
        endpoint,
        method: 'POST',
        domain: domainName,
        requestTimestamp,
        responseTimestamp,
        requestPayload,
        responseStatus: error.response?.status || null,
        responseData: error.response?.data || null,
        errorMessage: error.message,
        errorCode: error.code || null,
        errorType: error.response ? 'response_error' : (error.request ? 'no_response' : 'request_setup_error')
      }, 'Provider API error');

      // Log error to database
      await this.logApiCall({
        domainId,
        endpoint,
        method: 'POST',
        requestPayload,
        responseStatus: error.response?.status || null,
        responseData: error.response?.data || null,
        errorMessage: error.message,
        requestTimestamp,
        responseTimestamp
      });

      throw this.handleError(error);
    }
  }

  /**
   * Log API call to database
   * @param {Object} logData - Log data
   */
  async logApiCall(logData) {
    try {
      await providerApiLogRepository.create({
        ...logData,
        provider: this.name
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      logger.error({
        error: error.message,
        provider: this.name
      }, 'Failed to log API call to database');
    }
  }

  /**
   * Standardize TrueBiz API response
   * Based on TrueBiz OpenAPI Company schema:
   * - recommendation: { decision: 'Pass' | 'Fail' }
   * - name: string (company name)
   * - industry: { primary_industry: string, tags: [], naics: [], sic: [], mcc: [] }
   * - formation_type: string (business type)
   * - founded_year: number
   * - tracking_id: UUID
   * @param {Object} rawResponse - Raw TrueBiz API response
   * @returns {Object} Standardized format
   */
  standardizeResponse(rawResponse) {
    // TrueBiz returns the Company object directly
    const data = rawResponse;

    // Extract recommendation - TrueBiz uses { decision: 'Pass' | 'Fail' }
    // But may also return string values in some cases
    let recommendation = null;
    if (data.recommendation) {
      if (typeof data.recommendation === 'object' && data.recommendation.decision) {
        recommendation = data.recommendation.decision;
      } else if (typeof data.recommendation === 'string') {
        recommendation = data.recommendation;
      }
    }

    // Extract company name (OpenAPI: 'name' field)
    const name = data.name || null;

    // Extract industry (OpenAPI: 'industry.primary_industry')
    let industry = null;
    if (data.industry) {
      if (typeof data.industry === 'object' && data.industry.primary_industry) {
        industry = data.industry.primary_industry;
      } else if (typeof data.industry === 'string') {
        industry = data.industry;
      }
    }

    // Extract business type from formation_type (OpenAPI: 'formation_type')
    // Values: Corporation, LLC, Limited Partnership, etc.
    const businessType = data.formation_type || null;

    // Extract founded year (OpenAPI: 'founded_year' direct field)
    const foundedYear = data.founded_year || null;

    // Extract tracking ID (OpenAPI: 'tracking_id')
    const responseId = data.tracking_id || null;

    return {
      recommendation: this.mapRecommendation(recommendation),
      name,
      industry,
      businessType,
      foundedYear,
      rawData: rawResponse,
      provider: this.name,
      providerResponseId: responseId ? String(responseId) : null
    };
  }

  /**
   * Map TrueBiz recommendation to our format
   * TrueBiz OpenAPI uses: { decision: 'Pass' | 'Fail' }
   * We use: 'pass', 'review', 'fail'
   * @param {string} recommendation - TrueBiz recommendation value
   * @returns {string} 'pass' | 'fail' | 'review' | null
   */
  mapRecommendation(recommendation) {
    if (!recommendation) return null;

    // Handle case where recommendation might not be a string
    if (typeof recommendation !== 'string') {
      logger.warn({ recommendation, type: typeof recommendation }, 'Unexpected recommendation type from TrueBiz');
      // If it's an object with a decision property, extract it
      if (typeof recommendation === 'object' && recommendation.decision) {
        recommendation = String(recommendation.decision);
      } else {
        return 'review'; // Default to review for unknown types
      }
    }

    const recLower = recommendation.toLowerCase();

    // Map TrueBiz recommendations to our format
    // OpenAPI spec shows: Pass, Fail (in Recommendation schema)
    const mapping = {
      // TrueBiz OpenAPI primary recommendations
      'pass': 'pass',
      'fail': 'fail',
      // Legacy/alternative values (for backwards compatibility)
      'approve': 'pass',
      'review': 'review',
      'decline': 'fail',
      'verified': 'pass',
      'approved': 'pass',
      'active': 'pass',
      'valid': 'pass',
      'rejected': 'fail',
      'invalid': 'fail',
      'suspended': 'fail',
      'blocked': 'fail',
      'pending': 'review',
      'manual_review': 'review',
      'incomplete': 'review'
    };

    return mapping[recLower] || 'review';
  }

  /**
   * Build request payload for TrueBiz API
   * Maps internal field names to TrueBiz API field names
   * @param {string|Object} domainOrPayload - Domain string or full payload object
   * @returns {Object} TrueBiz API payload
   */
  buildRequestPayload(domainOrPayload) {
    // If it's just a string, treat it as domain
    if (typeof domainOrPayload === 'string') {
      return { domain: domainOrPayload };
    }

    const payload = {};
    const fieldMapping = {
      // Our field -> TrueBiz field
      domain: 'domain',
      name: 'submitted_business_name',
      description: 'submitted_description',
      website: 'submitted_website',
      addressLine1: 'address_line_1',
      addressLine2: 'address_line_2',
      city: 'city',
      stateProvince: 'state_province',
      postalCode: 'postal_code',
      country: 'country',
      email: 'submitted_email',
      phone: 'submitted_phone',
      fullName: 'submitted_full_name',
      externalTrackingRef: 'external_tracking_ref'
    };

    // Map fields, only include non-null/undefined values
    for (const [ourField, truebizField] of Object.entries(fieldMapping)) {
      if (domainOrPayload[ourField] !== undefined && domainOrPayload[ourField] !== null) {
        payload[truebizField] = domainOrPayload[ourField];
      }
    }

    return payload;
  }

  /**
   * Handle API errors
   * @param {Error} error - Axios error
   * @returns {Error} Processed error
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        return new Error('TrueBiz API authentication failed');
      }
      if (status === 403) {
        return new Error('TrueBiz API access forbidden');
      }
      if (status === 404) {
        return new Error('TrueBiz API endpoint not found');
      }
      if (status === 429) {
        return new Error('TrueBiz API rate limit exceeded');
      }
      if (status >= 500) {
        return new Error('TrueBiz API server error');
      }

      return new Error(data.message || 'TrueBiz API request failed');
    }

    if (error.request) {
      // Request was made but no response received
      if (error.code === 'ECONNABORTED') {
        return new Error(`TrueBiz API timeout after ${this.timeout}ms`);
      }
      if (error.code === 'ENOTFOUND') {
        return new Error(`TrueBiz API DNS lookup failed for ${this.apiBaseUrl}`);
      }
      if (error.code === 'ECONNREFUSED') {
        return new Error(`TrueBiz API connection refused at ${this.apiBaseUrl}`);
      }
      return new Error(`No response from TrueBiz API: ${error.code || error.message}`);
    }

    return error;
  }

  /**
   * Start monitoring a domain with TrueBiz
   * POST /monitoring/start
   * @param {string} domain - Domain to monitor
   * @param {string} domainId - Internal domain ID for logging
   * @param {string} externalRefId - Optional external reference ID
   * @returns {Promise<Object>} Monitoring response
   */
  async startMonitoring(domain, domainId = null, externalRefId = null) {
    const endpoint = '/monitoring/start';
    const requestPayload = {
      domain,
      ...(externalRefId && { external_ref_id: externalRefId })
    };
    const requestTimestamp = new Date().toISOString();

    logger.info({
      provider: 'truebiz',
      endpoint,
      method: 'POST',
      domain,
      requestPayload,
      requestTimestamp
    }, 'Starting domain monitoring');

    try {
      const response = await this.client.post(endpoint, requestPayload);
      const responseTimestamp = new Date().toISOString();

      logger.info({
        provider: 'truebiz',
        endpoint,
        method: 'POST',
        domain,
        responseStatus: response.status,
        responseData: response.data,
        requestTimestamp,
        responseTimestamp
      }, 'Monitoring started successfully');

      // Log to database
      await this.logApiCall({
        domainId,
        endpoint,
        method: 'POST',
        requestPayload,
        responseStatus: response.status,
        responseData: response.data,
        requestTimestamp,
        responseTimestamp
      });

      // OpenAPI MonitoredDomain response: { domain, external_ref_id, packages: [] }
      return {
        success: true,
        domain: response.data.domain,
        packages: response.data.packages || [],
        externalRefId: response.data.external_ref_id,
        rawData: response.data
      };

    } catch (error) {
      const responseTimestamp = new Date().toISOString();

      logger.error({
        provider: 'truebiz',
        endpoint,
        method: 'POST',
        domain,
        errorMessage: error.message,
        errorCode: error.code || null,
        responseStatus: error.response?.status || null,
        responseData: error.response?.data || null
      }, 'Failed to start monitoring');

      // Log error to database
      await this.logApiCall({
        domainId,
        endpoint,
        method: 'POST',
        requestPayload,
        responseStatus: error.response?.status || null,
        responseData: error.response?.data || null,
        errorMessage: error.message,
        requestTimestamp,
        responseTimestamp
      });

      throw this.handleError(error);
    }
  }

  /**
   * Stop monitoring a domain with TrueBiz
   * POST /monitoring/stop
   * @param {string} domain - Domain to stop monitoring
   * @param {string} domainId - Internal domain ID for logging
   * @returns {Promise<Object>} Stop monitoring response
   */
  async stopMonitoring(domain, domainId = null) {
    const endpoint = '/monitoring/stop';
    const requestPayload = { domain };
    const requestTimestamp = new Date().toISOString();

    logger.info({
      provider: 'truebiz',
      endpoint,
      method: 'POST',
      domain,
      requestPayload,
      requestTimestamp
    }, 'Stopping domain monitoring');

    try {
      const response = await this.client.post(endpoint, requestPayload);
      const responseTimestamp = new Date().toISOString();

      logger.info({
        provider: 'truebiz',
        endpoint,
        method: 'POST',
        domain,
        responseStatus: response.status,
        responseData: response.data,
        requestTimestamp,
        responseTimestamp
      }, 'Monitoring stopped successfully');

      // Log to database
      await this.logApiCall({
        domainId,
        endpoint,
        method: 'POST',
        requestPayload,
        responseStatus: response.status,
        responseData: response.data,
        requestTimestamp,
        responseTimestamp
      });

      return {
        success: true,
        domain: response.data.domain,
        rawData: response.data
      };

    } catch (error) {
      const responseTimestamp = new Date().toISOString();

      // If domain is not being monitored, that's OK - just log and return success
      if (error.response?.status === 404) {
        logger.info({
          provider: 'truebiz',
          domain,
          message: 'Domain was not being monitored'
        }, 'Stop monitoring - domain not found (OK)');

        return {
          success: true,
          domain,
          notMonitored: true
        };
      }

      logger.error({
        provider: 'truebiz',
        endpoint,
        method: 'POST',
        domain,
        errorMessage: error.message,
        errorCode: error.code || null,
        responseStatus: error.response?.status || null,
        responseData: error.response?.data || null
      }, 'Failed to stop monitoring');

      // Log error to database
      await this.logApiCall({
        domainId,
        endpoint,
        method: 'POST',
        requestPayload,
        responseStatus: error.response?.status || null,
        responseData: error.response?.data || null,
        errorMessage: error.message,
        requestTimestamp,
        responseTimestamp
      });

      throw this.handleError(error);
    }
  }

  /**
   * Check if TrueBiz API is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      // Use a lightweight endpoint to check connectivity
      await this.client.get('/monitoring/domains', { timeout: 5000, params: { limit: 1 } });
      return true;
    } catch (error) {
      logger.warn({ error: error.message }, 'TrueBiz health check failed');
      return false;
    }
  }

  /**
   * Get rate limit status
   * @returns {Promise<Object>} Rate limit info
   */
  async getRateLimitStatus() {
    try {
      const response = await this.client.get('/rate-limit');
      return response.data;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get rate limit status');
      return null;
    }
  }
}

module.exports = TrueBizProvider;
