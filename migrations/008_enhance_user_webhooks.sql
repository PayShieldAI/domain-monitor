-- Migration: Enhance existing webhook tables for retry logic and better tracking
-- Purpose: Add fields needed for automatic retries and comprehensive delivery tracking

-- Add columns to webhooks table (only if they don't exist)
SET @dbname = DATABASE();

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'description');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhooks ADD COLUMN description TEXT NULL COMMENT \'User description of the endpoint\' AFTER secret', 'SELECT "Column description already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'enabled');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhooks ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT \'Whether this endpoint is active\'', 'SELECT "Column enabled already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'last_delivery_at');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhooks ADD COLUMN last_delivery_at DATETIME NULL COMMENT \'Last successful delivery\'', 'SELECT "Column last_delivery_at already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'failed_deliveries');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhooks ADD COLUMN failed_deliveries INT NOT NULL DEFAULT 0 COMMENT \'Count of consecutive failed deliveries\'', 'SELECT "Column failed_deliveries already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'total_deliveries');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhooks ADD COLUMN total_deliveries INT NOT NULL DEFAULT 0 COMMENT \'Total delivery attempts\'', 'SELECT "Column total_deliveries already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'successful_deliveries');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE webhooks ADD COLUMN successful_deliveries INT NOT NULL DEFAULT 0 COMMENT \'Total successful deliveries\'', 'SELECT "Column successful_deliveries already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Modify URL column to support longer URLs
ALTER TABLE webhooks MODIFY COLUMN url VARCHAR(2048) NOT NULL COMMENT 'Webhook URL to send events to';

-- Make events column nullable (NULL = subscribe to all events)
ALTER TABLE webhooks MODIFY COLUMN events JSON NULL COMMENT 'Event types to subscribe to (NULL = all events)';

-- Add index on enabled column
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND INDEX_NAME = 'idx_enabled');
SET @sql = IF(@index_exists = 0, 'ALTER TABLE webhooks ADD INDEX idx_enabled (enabled)', 'SELECT "Index idx_enabled already exists" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop active column if it exists (replaced by enabled)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhooks' AND COLUMN_NAME = 'active');
SET @sql = IF(@col_exists > 0, 'ALTER TABLE webhooks DROP COLUMN active', 'SELECT "Column active already dropped" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Determine which table name to use (webhook_deliveries or webhook_delivery_logs)
SET @table_name = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs') > 0,
  'webhook_delivery_logs',
  'webhook_deliveries'
));

-- Add columns to webhook_deliveries/webhook_delivery_logs table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'domain_id');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN domain_id CHAR(36) NULL COMMENT \'Domain that triggered the event\''), CONCAT('SELECT "Column domain_id already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'attempt_number');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN attempt_number INT NOT NULL DEFAULT 1 COMMENT \'Delivery attempt number\''), CONCAT('SELECT "Column attempt_number already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'request_body');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN request_body JSON NULL COMMENT \'Webhook payload sent\''), CONCAT('SELECT "Column request_body already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'error_message');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN error_message TEXT NULL COMMENT \'Error message if delivery failed\''), CONCAT('SELECT "Column error_message already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'sent_at');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN sent_at DATETIME NULL COMMENT \'When the request was sent\''), CONCAT('SELECT "Column sent_at already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'completed_at');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN completed_at DATETIME NULL COMMENT \'When the response was received\''), CONCAT('SELECT "Column completed_at already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'duration_ms');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN duration_ms INT NULL COMMENT \'Time taken for delivery in milliseconds\''), CONCAT('SELECT "Column duration_ms already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'next_retry_at');
SET @sql = IF(@col_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD COLUMN next_retry_at DATETIME NULL COMMENT \'When to retry if failed\''), CONCAT('SELECT "Column next_retry_at already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Modify status column to include 'retrying' state (only if column exists)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'status');
SET @sql = IF(@col_exists > 0, CONCAT('ALTER TABLE ', @table_name, ' MODIFY COLUMN status ENUM(\'pending\', \'success\', \'failed\', \'retrying\') NOT NULL DEFAULT \'pending\''), CONCAT('SELECT "Column status does not exist in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Modify response_code to allow NULL (only if column exists)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'response_code');
SET @sql = IF(@col_exists > 0, CONCAT('ALTER TABLE ', @table_name, ' MODIFY COLUMN response_code INT NULL COMMENT \'HTTP response status code\''), CONCAT('SELECT "Column response_code does not exist in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add indexes
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND INDEX_NAME = 'idx_domain_id');
SET @sql = IF(@index_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD INDEX idx_domain_id (domain_id)'), CONCAT('SELECT "Index idx_domain_id already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND INDEX_NAME = 'idx_next_retry_at');
SET @sql = IF(@index_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD INDEX idx_next_retry_at (next_retry_at)'), CONCAT('SELECT "Index idx_next_retry_at already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add foreign key for domain_id
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = @dbname AND TABLE_NAME = @table_name AND CONSTRAINT_NAME = 'fk_webhook_deliveries_domain_id');
SET @sql = IF(@fk_exists = 0, CONCAT('ALTER TABLE ', @table_name, ' ADD CONSTRAINT fk_webhook_deliveries_domain_id FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL'), CONCAT('SELECT "Foreign key fk_webhook_deliveries_domain_id already exists in ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop old columns if they exist
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'attempts');
SET @sql = IF(@col_exists > 0, CONCAT('ALTER TABLE ', @table_name, ' DROP COLUMN attempts'), CONCAT('SELECT "Column attempts already dropped from ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @table_name AND COLUMN_NAME = 'last_attempt_at');
SET @sql = IF(@col_exists > 0, CONCAT('ALTER TABLE ', @table_name, ' DROP COLUMN last_attempt_at'), CONCAT('SELECT "Column last_attempt_at already dropped from ', @table_name, '" AS message'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rename table to webhook_delivery_logs if not already renamed
SET @table_exists = (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'webhook_delivery_logs');
SET @sql = IF(@table_exists = 0, 'RENAME TABLE webhook_deliveries TO webhook_delivery_logs', 'SELECT "Table already renamed to webhook_delivery_logs" AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add comments to tables
ALTER TABLE webhooks COMMENT = 'User-defined webhook endpoints for receiving domain events';
ALTER TABLE webhook_delivery_logs COMMENT = 'Logs of webhook delivery attempts to user endpoints';
