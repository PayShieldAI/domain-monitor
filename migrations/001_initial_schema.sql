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
);

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
);

-- Providers (domain intelligence providers)
CREATE TABLE providers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 100,
  api_base_url VARCHAR(500) NOT NULL,
  api_key_encrypted VARCHAR(500) NOT NULL,
  rate_limit INT DEFAULT 60,
  timeout INT DEFAULT 10000,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_enabled_priority (enabled, priority)
);

-- Monitored Domains
CREATE TABLE domains (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  status ENUM('active', 'inactive') DEFAULT 'active',
  recommendation ENUM('pass', 'fail', 'review') NULL,
  industry VARCHAR(255),
  business_type VARCHAR(255),
  founded_year SMALLINT,
  raw_data JSON,
  provider VARCHAR(50),
  provider_response_id VARCHAR(255),
  check_frequency ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily',
  last_checked_at TIMESTAMP NULL,
  next_check_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_user_domain (user_id, domain),
  INDEX idx_user_status (user_id, status),
  INDEX idx_next_check (next_check_at, status),
  INDEX idx_recommendation (user_id, recommendation)
);

-- Webhooks
CREATE TABLE webhooks (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  url VARCHAR(500) NOT NULL,
  events JSON NOT NULL,
  secret VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_active (user_id, active)
);

-- Webhook Delivery Log (for debugging/retry)
CREATE TABLE webhook_deliveries (
  id CHAR(36) PRIMARY KEY,
  webhook_id CHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSON NOT NULL,
  status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP NULL,
  response_code SMALLINT,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  INDEX idx_status_attempts (status, attempts, last_attempt_at)
);

-- Domain Check History (for audit/trends)
CREATE TABLE domain_check_history (
  id CHAR(36) PRIMARY KEY,
  domain_id CHAR(36) NOT NULL,
  recommendation ENUM('pass', 'fail', 'review') NULL,
  provider VARCHAR(50),
  raw_data JSON,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  INDEX idx_domain_checked (domain_id, checked_at)
);

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
);

-- Reseller-Merchant Relationships
-- Maps which merchants a reseller can access
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
);

-- Note: Providers should be added via API or admin panel after deployment
-- with encrypted API keys. Do not store unencrypted keys in migrations.
