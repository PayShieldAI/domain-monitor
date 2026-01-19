-- ===========================================
-- Domain Monitor - Provider API Logs
-- ===========================================
-- Migration: 004_add_provider_api_logs.sql
-- Description: Creates table for logging provider API requests and responses
-- ===========================================

-- Provider API Logs (for debugging and auditing)
CREATE TABLE IF NOT EXISTS provider_api_logs (
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
);

-- Add index for cleanup of old logs (retention policy)
CREATE INDEX idx_provider_api_logs_cleanup ON provider_api_logs (created_at);
