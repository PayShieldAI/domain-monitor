-- ===========================================
-- Domain Monitor - Initial Schema
-- ===========================================
-- Migration: 001_initial_schema.sql
-- Description: Creates all core tables for the domain monitoring service
-- ===========================================

-- Users (self-managed authentication)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role ENUM('superadmin', 'reseller', 'merchant') DEFAULT 'merchant',
  status ENUM('active', 'inactive', 'pending_verification') DEFAULT 'pending_verification',
  email_verified_at TIMESTAMP NULL,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh Tokens (for JWT refresh)
CREATE TABLE refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_expires (user_id, expires_at),
  INDEX idx_token_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Tokens (persistent JWT access tokens)
CREATE TABLE user_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE INDEX idx_user_id_unique (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password Reset Tokens
CREATE TABLE password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash),
  INDEX idx_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reseller-Merchant Relationships
CREATE TABLE reseller_merchant_relationships (
  id CHAR(36) PRIMARY KEY,
  reseller_id CHAR(36) NOT NULL,
  merchant_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reseller_merchant (reseller_id, merchant_id),
  INDEX idx_reseller (reseller_id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Keys (for machine-to-machine authentication)
CREATE TABLE api_keys (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Descriptive name for the API key',
  key_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hash of the API key',
  key_prefix VARCHAR(16) NOT NULL COMMENT 'First 8 chars of key for identification',
  user_id CHAR(36) NULL COMMENT 'Optional: user who created this key',
  permissions JSON NULL COMMENT 'JSON array of allowed operations/scopes',
  description TEXT NULL COMMENT 'Purpose and usage notes',
  last_used_at DATETIME NULL COMMENT 'Last time this key was used',
  expires_at DATETIME NULL COMMENT 'Optional expiration date',
  revoked_at DATETIME NULL COMMENT 'When the key was revoked',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_key_prefix (key_prefix),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_revoked_at (revoked_at),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API keys for machine-to-machine authentication';

-- Providers (domain intelligence providers)
CREATE TABLE providers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 100,
  api_base_url VARCHAR(500) NOT NULL,
  api_key_encrypted VARCHAR(500) NOT NULL,
  webhook_secret_encrypted VARCHAR(500) NULL,
  rate_limit INT DEFAULT 60,
  timeout INT DEFAULT 10000,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_enabled_priority (enabled, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Monitored Domains
CREATE TABLE domains (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  domain VARCHAR(255) NULL,
  name VARCHAR(255),
  status ENUM('active', 'inactive') DEFAULT 'active',
  recommendation ENUM('pass', 'fail', 'review') NULL,
  industry VARCHAR(255),
  business_type VARCHAR(255),
  founded_year SMALLINT,
  raw_data JSON,
  provider VARCHAR(50),
  provider_response_id VARCHAR(255),
  check_frequency ENUM('7', '30', '90') NULL,
  last_checked_at TIMESTAMP NULL,
  next_check_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_domain (user_id, domain),
  INDEX idx_user_status (user_id, status),
  INDEX idx_next_check (next_check_at, status),
  INDEX idx_recommendation (user_id, recommendation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Domain Submissions (stores original submitted data)
CREATE TABLE domain_submissions (
  id CHAR(36) PRIMARY KEY,
  domain_id CHAR(36) NOT NULL,
  submitted_domain_name VARCHAR(255),
  submitted_business_name VARCHAR(255),
  submitted_description TEXT,
  submitted_website VARCHAR(500),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  submitted_email VARCHAR(255),
  submitted_phone VARCHAR(50),
  submitted_full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  INDEX idx_domain_id (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Domain Monitoring (monitoring configuration)
CREATE TABLE domain_monitoring (
  id CHAR(36) PRIMARY KEY,
  domain_id CHAR(36) NOT NULL,
  check_frequency VARCHAR(20) NOT NULL COMMENT 'Monitoring frequency: 7, 30, 90 days',
  events JSON NULL COMMENT 'Events to trigger notifications',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '0=inactive, 1=active',
  next_check_at DATETIME NULL COMMENT 'Next scheduled check time',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  UNIQUE INDEX idx_domain_id (domain_id),
  INDEX idx_status (status),
  INDEX idx_next_check (next_check_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Webhooks (user-defined webhook endpoints)
CREATE TABLE user_webhooks (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  url VARCHAR(2048) NOT NULL COMMENT 'Webhook URL to send events to',
  events JSON NULL COMMENT 'Event types to subscribe to (NULL = all events)',
  secret VARCHAR(255) NOT NULL,
  description TEXT NULL COMMENT 'User description of the endpoint',
  enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether this endpoint is active',
  last_delivery_at DATETIME NULL COMMENT 'Last successful delivery',
  failed_deliveries INT NOT NULL DEFAULT 0 COMMENT 'Count of consecutive failed deliveries',
  total_deliveries INT NOT NULL DEFAULT 0 COMMENT 'Total delivery attempts',
  successful_deliveries INT NOT NULL DEFAULT 0 COMMENT 'Total successful deliveries',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, enabled),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User-defined webhook endpoints for receiving domain events';

-- User Webhook Delivery Logs
CREATE TABLE user_webhook_delivery_logs (
  id CHAR(36) PRIMARY KEY,
  endpoint_id CHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  domain_id CHAR(36) NULL COMMENT 'Domain that triggered the event',
  attempt_number INT NOT NULL DEFAULT 1 COMMENT 'Delivery attempt number',
  request_body JSON NULL COMMENT 'Webhook payload sent',
  status ENUM('pending', 'success', 'failed', 'retrying') NOT NULL DEFAULT 'pending',
  response_status INT NULL COMMENT 'HTTP response status code',
  response_body TEXT,
  error_message TEXT NULL COMMENT 'Error message if delivery failed',
  sent_at DATETIME NULL COMMENT 'When the request was sent',
  completed_at DATETIME NULL COMMENT 'When the response was received',
  duration_ms INT NULL COMMENT 'Time taken for delivery in milliseconds',
  next_retry_at DATETIME NULL COMMENT 'When to retry if failed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (endpoint_id) REFERENCES user_webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
  INDEX idx_endpoint_id (endpoint_id),
  INDEX idx_domain_id (domain_id),
  INDEX idx_status_attempts (status, attempt_number),
  INDEX idx_next_retry_at (next_retry_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Logs of webhook delivery attempts to user endpoints';

-- Provider Webhook Events (incoming webhooks from providers)
CREATE TABLE provider_webhook_events (
  id CHAR(36) PRIMARY KEY,
  provider_id CHAR(36) NULL,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NULL,
  alert_id VARCHAR(255) NULL,
  alert_response JSON NULL,
  domain_id CHAR(36) NULL,
  payload JSON NOT NULL,
  signature VARCHAR(500),
  verified BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  error_message TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
  INDEX idx_provider_id (provider_id),
  INDEX idx_provider (provider),
  INDEX idx_domain_id (domain_id),
  INDEX idx_event_type (event_type),
  INDEX idx_event_category (event_category),
  INDEX idx_alert_id (alert_id),
  INDEX idx_processed (processed),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Provider API Logs (for debugging and auditing)
CREATE TABLE provider_api_logs (
  id CHAR(36) PRIMARY KEY,
  domain_id CHAR(36) NULL,
  provider VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_payload JSON,
  response_status SMALLINT,
  response_data JSON,
  error_message TEXT,
  request_timestamp TIMESTAMP(3) NOT NULL,
  response_timestamp TIMESTAMP(3) NOT NULL,
  duration_ms INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MICROSECOND, request_timestamp, response_timestamp) / 1000) STORED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
  INDEX idx_provider_timestamp (provider, request_timestamp),
  INDEX idx_domain_id (domain_id),
  INDEX idx_response_status (response_status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Logs (request/response logging)
CREATE TABLE api_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  query_params JSON NULL,
  headers JSON NULL,
  request_body JSON NULL,
  response_status INT NOT NULL,
  response_body JSON NULL,
  duration_ms INT NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_method (method),
  INDEX idx_path (path(255)),
  INDEX idx_status (response_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
