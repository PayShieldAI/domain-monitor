-- Migration: Fix webhook_delivery_logs column names
-- Purpose: Rename webhook_id to endpoint_id and response_code to response_status for consistency
-- Created: 2026-01-26

SET @dbname = DATABASE();

-- Check if webhook_delivery_logs table exists
SET @table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs');

-- Drop old webhook_deliveries table if it exists (replaced by webhook_delivery_logs)
DROP TABLE IF EXISTS webhook_deliveries;

-- Rename webhook_id to endpoint_id if it exists
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND COLUMN_NAME = 'webhook_id');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE webhook_delivery_logs CHANGE COLUMN webhook_id endpoint_id CHAR(36) NOT NULL', 'SELECT "Column webhook_id does not exist or already renamed to endpoint_id" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rename response_code to response_status if it exists
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND COLUMN_NAME = 'response_code');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE webhook_delivery_logs CHANGE COLUMN response_code response_status INT NULL COMMENT \'HTTP response status code\'', 'SELECT "Column response_code does not exist or already renamed to response_status" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop payload column if it exists (duplicate of request_body)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND COLUMN_NAME = 'payload');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE webhook_delivery_logs DROP COLUMN payload', 'SELECT "Column payload does not exist or already dropped" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Update foreign key if it references old column name
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND CONSTRAINT_NAME = 'webhook_delivery_logs_ibfk_1');
SET @sql = IF(@fk_exists > 0, 'ALTER TABLE webhook_delivery_logs DROP FOREIGN KEY webhook_delivery_logs_ibfk_1', 'SELECT "Foreign key webhook_delivery_logs_ibfk_1 does not exist" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add new foreign key with correct column name
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND COLUMN_NAME = 'endpoint_id');
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND CONSTRAINT_NAME = 'fk_delivery_logs_endpoint');
SET @sql = IF(@col_exists > 0 AND @fk_exists = 0, 'ALTER TABLE webhook_delivery_logs ADD CONSTRAINT fk_delivery_logs_endpoint FOREIGN KEY (endpoint_id) REFERENCES webhooks(id) ON DELETE CASCADE', 'SELECT "Foreign key fk_delivery_logs_endpoint already exists or endpoint_id column missing" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add index on endpoint_id if not exists
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND INDEX_NAME = 'idx_endpoint_id');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE webhook_delivery_logs ADD INDEX idx_endpoint_id (endpoint_id)', 'SELECT "Index idx_endpoint_id already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add foreign key for domain_id if not exists
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs' AND CONSTRAINT_NAME = 'fk_delivery_logs_domain');
SET @sql = IF(@fk_exists = 0, 'ALTER TABLE webhook_delivery_logs ADD CONSTRAINT fk_delivery_logs_domain FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL', 'SELECT "Foreign key fk_delivery_logs_domain already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
