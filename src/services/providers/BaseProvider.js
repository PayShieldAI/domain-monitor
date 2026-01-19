/**
 * Base Provider Interface
 * All domain intelligence providers must extend this class
 */
class BaseProvider {
  constructor(config) {
    this.name = config.name;
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 10000;
    this.rateLimit = config.rateLimit || 60;
  }

  /**
   * Check a single domain
   * Must be implemented by child classes
   * @param {string} domain - Domain name to check
   * @returns {Promise<Object>} Standardized result
   */
  async checkDomain(domain) {
    throw new Error('checkDomain() must be implemented by provider');
  }

  /**
   * Standardize the response from provider
   * @param {Object} rawResponse - Raw API response
   * @returns {Object} Standardized format
   */
  standardizeResponse(rawResponse) {
    return {
      recommendation: null,  // 'pass' | 'fail' | 'review'
      name: null,
      industry: null,
      businessType: null,
      foundedYear: null,
      rawData: rawResponse,
      provider: this.name,
      providerResponseId: null
    };
  }

  /**
   * Check if provider is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      // Basic connectivity check
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get provider configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      name: this.name,
      apiBaseUrl: this.apiBaseUrl,
      timeout: this.timeout,
      rateLimit: this.rateLimit
    };
  }
}

module.exports = BaseProvider;
