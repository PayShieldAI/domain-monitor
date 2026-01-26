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
      // Validate and log if domainId is missing
      if (!logData.domainId) {
        logger.warn({
          provider: this.name,
          endpoint: logData.endpoint,
          method: logData.method,
          hasPayload: !!logData.requestPayload
        }, 'Provider API call logged without domainId - this may indicate a bug');
      }

      await providerApiLogRepository.create({
        ...logData,
        provider: this.name
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      logger.error({
        error: error.message,
        stack: error.stack,
        provider: this.name,
        domainId: logData.domainId,
        endpoint: logData.endpoint
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
   * @param {string} checkFrequency - Check frequency in days ('7', '30', '90')
   * @returns {Promise<Object>} Monitoring response
   */
  async startMonitoring(domain, domainId = null, externalRefId = null, checkFrequency = '7') {
    const endpoint = '/monitoring/start';

    // Build packages array with frequency
    // TrueBiz API expects frequency in days as integer
    const frequencyDays = parseInt(checkFrequency, 10) || 7;
    const packages = [
      {
        type: 'io.truebiz.monitoring.packages.basic',
        frequency: {
          days: frequencyDays
        }
      }
    ];

    const requestPayload = {
      domain,
      packages,
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

  /**
   * Map TrueBiz event types to user event types
   * TrueBiz may send event variations like:
   * - business-closed, business-closed-site-content, etc. → business-closed
   * - sentiment, sentiment-negative, etc. → sentiment
   * - website, website-down, etc. → website
   * - business-profile, business-profile-updated, etc. → business-profile
   *
   * @param {string} truebizEventType - TrueBiz event type
   * @returns {string|null} User event type or null if not mappable
   */
  mapEventTypeToUserEvent(truebizEventType) {
    if (!truebizEventType) return null;

    const eventLower = truebizEventType.toLowerCase();

    // Map TrueBiz event patterns to user events
    // Check prefixes to handle variations
    if (eventLower.startsWith('business-closed')) {
      return 'business-closed';
    }
    if (eventLower.startsWith('sentiment')) {
      return 'sentiment';
    }
    if (eventLower.startsWith('website')) {
      return 'website';
    }
    if (eventLower.startsWith('business-profile')) {
      return 'business-profile';
    }

    // No mapping found
    return null;
  }

  /**
   * Handle webhook from TrueBiz
   *
   * Two webhook types:
   * 1. Company Match Request: { messages, resource_id, resource_type: "companymatchrequest", subject_urn }
   * 2. Monitoring Alert: { type: "io.truebiz.monitoring.alert", alert_details_link, created_at, ui_portal_link }
   *
   * @param {Object} webhookPayload - Webhook payload from TrueBiz
   * @param {Function} findDomainByExternalRef - Function to find domain by external_ref_id
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhook(webhookPayload, findDomainByExternalRef) {
    logger.info({
      provider: 'truebiz',
      eventType: webhookPayload.type || webhookPayload.resource_type,
      payload: webhookPayload
    }, 'Processing TrueBiz webhook');

    try {
      // Handle different webhook types
      if (webhookPayload.resource_type === 'companymatchrequest') {
        return await this.handleCompanyMatchRequest(webhookPayload, findDomainByExternalRef);
      } else if (webhookPayload.type === 'io.truebiz.monitoring.alert') {
        return await this.handleMonitoringAlert(webhookPayload, findDomainByExternalRef);
      } else {
        logger.warn({ webhookPayload }, 'Unknown TrueBiz webhook type');
        return {
          processed: false,
          error: 'Unknown webhook type',
          webhookPayload
        };
      }
    } catch (error) {
      logger.error({
        provider: 'truebiz',
        error: error.message,
        stack: error.stack,
        webhookPayload
      }, 'Error processing TrueBiz webhook');
      throw error;
    }
  }

  /**
   * Handle company match request webhook
   */
  async handleCompanyMatchRequest(webhookPayload, findDomainByExternalRef) {
    logger.info({
      resourceId: webhookPayload.resource_id,
      subjectUrn: webhookPayload.subject_urn,
      messages: webhookPayload.messages
    }, 'Processing company match request webhook');

    // For company match requests, we need to extract the domain from subject_urn
    // Format: urn:domain:example.com
    const urnMatch = webhookPayload.subject_urn?.match(/urn:domain:(.+)/);
    const domainName = urnMatch ? urnMatch[1] : null;

    if (!domainName) {
      logger.warn({ subjectUrn: webhookPayload.subject_urn }, 'Could not extract domain from subject_urn');
      return {
        processed: false,
        error: 'Could not extract domain from subject_urn',
        webhookPayload
      };
    }

    // Find domain in our database
    const domainRepository = require('../../repositories/domainRepository');
    const domain = await domainRepository.findByDomain(domainName);

    if (!domain) {
      logger.warn({ domainName }, 'Domain not found for company match request');
      return {
        processed: false,
        error: 'Domain not found',
        domainName,
        webhookPayload
      };
    }

    logger.info({
      domainId: domain.id,
      domainName,
      resourceId: webhookPayload.resource_id
    }, 'Company match request webhook processed');

    // Company match requests are business-profile related events
    return {
      processed: true,
      domainId: domain.id,
      domain: domainName,
      event_category: 'business-profile',
      action: 'company_match_request_received',
      webhookPayload
    };
  }

  /**
   * Handle monitoring alert webhook
   */
  async handleMonitoringAlert(webhookPayload, findDomainByExternalRef) {
    // Extract alert ID from the detail link (note: it's "alert_details_link" plural, not "alert_detail_link")
    const alertDetailUrl = webhookPayload.alert_details_link?.href;
    if (!alertDetailUrl) {
      logger.error({ webhookPayload }, 'No alert_details_link in monitoring alert payload');
      throw new Error('No alert_details_link in webhook payload');
    }

    // Try to fetch full alert details from TrueBiz API
    // Note: This may fail with 404 if the alert is not yet available or requires different auth
    let alertData = null;
    try {
      logger.info({ alertDetailUrl }, 'Fetching alert details from TrueBiz');
      const alertResponse = await this.client.get(alertDetailUrl);
      alertData = alertResponse.data;

      logger.info({
        alertId: alertData.id,
        domain: alertData.domain,
        externalRefId: alertData.external_ref_id,
        flaggedCategories: alertData.flagged_categories
      }, 'Retrieved alert details from TrueBiz');
    } catch (error) {
      logger.warn({
        alertDetailUrl,
        error: error.message,
        status: error.response?.status
      }, 'Could not fetch alert details from TrueBiz API - webhook logged but no domain action taken');

      // If we can't fetch details, we can't process this alert fully
      // Return early with the webhook data logged
      return {
        processed: true,
        error: 'Alert details not accessible via API',
        note: 'Webhook received and logged, but full alert details could not be retrieved',
        alertDetailUrl,
        webhookPayload
      };
    }

    // Find the domain in our database using external_ref_id or domain name
    let domain = null;
    if (alertData.external_ref_id) {
      domain = await findDomainByExternalRef(alertData.external_ref_id);
      logger.info({
        externalRefId: alertData.external_ref_id,
        found: !!domain
      }, 'Looked up domain by external_ref_id');
    }

    // If not found by external ref, try by domain name
    if (!domain && alertData.domain) {
      const domainRepository = require('../../repositories/domainRepository');
      domain = await domainRepository.findByDomain(alertData.domain);
      logger.info({
        domainName: alertData.domain,
        found: !!domain
      }, 'Looked up domain by domain name');
    }

    if (!domain) {
      logger.warn({
        alertDomain: alertData.domain,
        externalRefId: alertData.external_ref_id
      }, 'Could not find matching domain for webhook alert');

      return {
        processed: true,
        note: 'Alert received but domain not found in database',
        alertData
      };
    }

    // Update domain with alert information
    // For monitoring alerts, we typically want to log the flagged categories
    // but not change the recommendation unless specified
    const domainRepository = require('../../repositories/domainRepository');

    // Create a check history entry for this alert
    await domainRepository.createCheckHistory({
      domainId: domain.id,
      recommendation: 'review', // Alerts typically mean something needs review
      provider: 'truebiz',
      rawData: alertData
    });

    // Extract event category from flagged categories
    // flagged_categories could be an array or an object
    let eventCategory = null;
    if (alertData.flagged_categories) {
      if (Array.isArray(alertData.flagged_categories) && alertData.flagged_categories.length > 0) {
        // If it's an array, use the first category
        const firstCategory = alertData.flagged_categories[0];
        const categoryName = typeof firstCategory === 'string' ? firstCategory : firstCategory?.name;
        eventCategory = this.mapEventTypeToUserEvent(categoryName);
      } else if (typeof alertData.flagged_categories === 'object' && alertData.flagged_categories.name) {
        // If it's an object with name property
        eventCategory = this.mapEventTypeToUserEvent(alertData.flagged_categories.name);
      } else if (typeof alertData.flagged_categories === 'string') {
        // If it's just a string
        eventCategory = this.mapEventTypeToUserEvent(alertData.flagged_categories);
      }
    }

    // Fallback to payload type if no category found
    if (!eventCategory && webhookPayload.type) {
      eventCategory = this.mapEventTypeToUserEvent(webhookPayload.type);
    }

    logger.info({
      domainId: domain.id,
      domain: domain.domain,
      alertId: alertData.id,
      flaggedCategories: alertData.flagged_categories,
      eventCategory
    }, 'Monitoring alert webhook processed successfully - check history created');

    return {
      processed: true,
      domainId: domain.id,
      domain: domain.domain,
      event_category: eventCategory,
      alertData,
      action: 'check_history_created'
    };
  }

  /**
   * Verify webhook signature using Svix
   * @param {string} rawBody - Raw request body
   * @param {Object} headers - Request headers
   * @param {string} webhookSecret - Webhook secret for verification
   * @returns {Promise<Object>} Verified payload
   */
  async verifyWebhookSignature(rawBody, headers, webhookSecret) {
    const { Webhook } = require('svix');

    try {
      const wh = new Webhook(webhookSecret);

      // Svix verify returns the verified payload
      const verifiedPayload = wh.verify(rawBody, {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature']
      });

      logger.info({ provider: 'truebiz' }, 'Webhook signature verified successfully');
      return verifiedPayload;
    } catch (error) {
      logger.error({
        provider: 'truebiz',
        error: error.message
      }, 'Webhook signature verification failed');
      throw new Error('Invalid webhook signature');
    }
  }

  /**
   * Process webhook event (signature already verified)
   * @param {Object} payload - Webhook payload
   * @returns {Promise<Object>} Processing result
   */
  async processWebhook(payload) {
    return this.handleWebhook(payload);
  }
}

module.exports = TrueBizProvider;
