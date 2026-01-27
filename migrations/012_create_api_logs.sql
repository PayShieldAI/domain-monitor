-- Migration: Create api_logs table for request/response logging
-- Created: 2026-01-23

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
