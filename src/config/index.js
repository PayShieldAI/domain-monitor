require('dotenv').config({ path: '.env.local' });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || 'never', // Set to 'never' for non-expiring tokens
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d'
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  api: {
    baseUrls: {
      development: process.env.API_BASE_URL_DEV || 'https://dev-domainmonitor.ipo-servers.net',
      uat: process.env.API_BASE_URL_UAT || 'https://uat-monitor.payshield.ai',
      production: process.env.API_BASE_URL_PROD || 'https://monitor.payshield.ai'
    }
  apiLogging: {
    enabled: process.env.API_LOGGING_ENABLED === 'true' || process.env.NODE_ENV !== 'test',
    logRequestBody: process.env.API_LOGGING_REQUEST_BODY !== 'false',
    logResponseBody: process.env.API_LOGGING_RESPONSE_BODY === 'true'
  },

  isDevelopment() {
    return this.env === 'development';
  },

  isProduction() {
    return this.env === 'production';
  },

  isUAT() {
    return this.env === 'uat';
  },

  getApiBaseUrl() {
    return this.api.baseUrls[this.env] || this.api.baseUrls.development;
  }
};

function validateConfig() {
  const required = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = config;
module.exports.validateConfig = validateConfig;
