-- ===========================================
-- Migration: 016_add_alert_fields_to_provider_webhook_events.sql
-- Description: Add alert_id and alert_response columns to provider_webhook_events table
--              for storing TrueBiz monitoring alert details
-- ===========================================

SET @dbname = DATABASE();

-- Add alert_id column to provider_webhook_events table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @dbname
                   AND TABLE_NAME = 'provider_webhook_events'
                   AND COLUMN_NAME = 'alert_id');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE provider_webhook_events ADD COLUMN alert_id VARCHAR(255) NULL AFTER event_category',
    'SELECT "Column alert_id already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add alert_response column to provider_webhook_events table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @dbname
                   AND TABLE_NAME = 'provider_webhook_events'
                   AND COLUMN_NAME = 'alert_response');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE provider_webhook_events ADD COLUMN alert_response JSON NULL AFTER alert_id',
    'SELECT "Column alert_response already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on alert_id for faster lookups
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = @dbname
                     AND TABLE_NAME = 'provider_webhook_events'
                     AND INDEX_NAME = 'idx_alert_id');

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE provider_webhook_events ADD INDEX idx_alert_id (alert_id)',
    'SELECT "Index idx_alert_id already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
