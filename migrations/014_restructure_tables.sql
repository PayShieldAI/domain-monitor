-- ===========================================
-- Migration: 014_restructure_tables.sql
-- Description: Restructure webhook and domain tables
-- ===========================================

SET @dbname = DATABASE();

-- 1. Delete domain_check_history table
DROP TABLE IF EXISTS domain_check_history;

-- 2. Delete user_webhook_endpoints table (if exists)
DROP TABLE IF EXISTS user_webhook_endpoints;

-- 3. Remove provider_* fields from domain_submissions table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'domain_submissions' AND COLUMN_NAME = 'provider_business_name');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE domain_submissions DROP COLUMN provider_business_name', 'SELECT "Column provider_business_name does not exist" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'domain_submissions' AND COLUMN_NAME = 'provider_industry');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE domain_submissions DROP COLUMN provider_industry', 'SELECT "Column provider_industry does not exist" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'domain_submissions' AND COLUMN_NAME = 'provider_business_type');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE domain_submissions DROP COLUMN provider_business_type', 'SELECT "Column provider_business_type does not exist" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'domain_submissions' AND COLUMN_NAME = 'provider_founded_year');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE domain_submissions DROP COLUMN provider_founded_year', 'SELECT "Column provider_founded_year does not exist" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Add submitted_domain_name to domain_submissions table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'domain_submissions' AND COLUMN_NAME = 'submitted_domain_name');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE domain_submissions ADD COLUMN submitted_domain_name VARCHAR(255) AFTER domain_id', 'SELECT "Column submitted_domain_name already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5. Rename webhook_events to provider_webhook_events
SET @table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_events');
SET @new_table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'provider_webhook_events');
SET @sql = IF(@table_exists > 0 AND @new_table_exists = 0, 'RENAME TABLE webhook_events TO provider_webhook_events', 'SELECT "Table webhook_events does not exist or already renamed" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. Add provider_id to provider_webhook_events table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'provider_webhook_events' AND COLUMN_NAME = 'provider_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE provider_webhook_events ADD COLUMN provider_id CHAR(36) NULL AFTER id', 'SELECT "Column provider_id already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add foreign key for provider_id
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = 'provider_webhook_events' AND CONSTRAINT_NAME = 'fk_provider_webhook_events_provider');
SET @sql = IF(@fk_exists = 0, 'ALTER TABLE provider_webhook_events ADD CONSTRAINT fk_provider_webhook_events_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL', 'SELECT "Foreign key fk_provider_webhook_events_provider already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add index on provider_id
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'provider_webhook_events' AND INDEX_NAME = 'idx_provider_id');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE provider_webhook_events ADD INDEX idx_provider_id (provider_id)', 'SELECT "Index idx_provider_id already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. Rename webhooks to user_webhooks
SET @table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks');
SET @new_table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'user_webhooks');
SET @sql = IF(@table_exists > 0 AND @new_table_exists = 0, 'RENAME TABLE webhooks TO user_webhooks', 'SELECT "Table webhooks does not exist or already renamed" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 8. Rename webhook_delivery_logs to user_webhook_delivery_logs
SET @table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs');
SET @new_table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'user_webhook_delivery_logs');
SET @sql = IF(@table_exists > 0 AND @new_table_exists = 0, 'RENAME TABLE webhook_delivery_logs TO user_webhook_delivery_logs', 'SELECT "Table webhook_delivery_logs does not exist or already renamed" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update foreign key in user_webhook_delivery_logs to reference user_webhooks
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = 'user_webhook_delivery_logs' AND CONSTRAINT_NAME = 'fk_delivery_logs_endpoint');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE user_webhook_delivery_logs DROP FOREIGN KEY fk_delivery_logs_endpoint', 'SELECT "Foreign key fk_delivery_logs_endpoint does not exist" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = 'user_webhook_delivery_logs' AND CONSTRAINT_NAME = 'fk_user_webhook_delivery_logs_endpoint');
SET @sql = IF(@fk_exists = 0, 'ALTER TABLE user_webhook_delivery_logs ADD CONSTRAINT fk_user_webhook_delivery_logs_endpoint FOREIGN KEY (endpoint_id) REFERENCES user_webhooks(id) ON DELETE CASCADE', 'SELECT "Foreign key fk_user_webhook_delivery_logs_endpoint already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 9. Create domain_monitoring table
CREATE TABLE IF NOT EXISTS domain_monitoring (
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
