-- Migration: Add webhook events tracking table
-- Stores incoming webhook events from all providers

CREATE TABLE IF NOT EXISTS webhook_events (
  id CHAR(36) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  
  -- Domain reference (matched by external_ref_id or domain name)
  domain_id CHAR(36),
  
  -- Webhook payload
  payload JSON NOT NULL,
  
  -- Signature verification
  signature VARCHAR(500),
  verified BOOLEAN DEFAULT FALSE,
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  error_message TEXT,
  
  -- Timestamps
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_provider (provider),
  INDEX idx_domain_id (domain_id),
  INDEX idx_event_type (event_type),
  INDEX idx_processed (processed),
  INDEX idx_received_at (received_at),
  
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
