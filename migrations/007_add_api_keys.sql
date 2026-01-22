-- Migration: Add API Keys table for machine-to-machine authentication
-- Purpose: Allow external systems to authenticate without user credentials

CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Descriptive name for the API key (e.g., "Monitoring System", "Payment Gateway")',
  key_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt hash of the API key',
  key_prefix VARCHAR(16) NOT NULL COMMENT 'First 8 chars of key for identification (e.g., "dmk_1234...")',

  -- Optional association with a user (for audit/ownership)
  user_id CHAR(36) NULL COMMENT 'Optional: user who created this key',

  -- Permissions and scope
  permissions JSON NULL COMMENT 'JSON array of allowed operations/scopes',

  -- Metadata
  description TEXT NULL COMMENT 'Purpose and usage notes',
  last_used_at DATETIME NULL COMMENT 'Last time this key was used',

  -- Lifecycle
  expires_at DATETIME NULL COMMENT 'Optional expiration date',
  revoked_at DATETIME NULL COMMENT 'When the key was revoked',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_key_prefix (key_prefix),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_revoked_at (revoked_at),
  INDEX idx_created_at (created_at),

  -- Foreign keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment to table
ALTER TABLE api_keys COMMENT = 'API keys for machine-to-machine authentication';
