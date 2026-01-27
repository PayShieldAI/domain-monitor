-- ===========================================
-- Migration: 015_add_event_category_to_provider_webhook_events.sql
-- Description: Add event_category column to provider_webhook_events table
-- ===========================================

SET @dbname = DATABASE();

-- Add event_category column to provider_webhook_events table
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @dbname
                   AND TABLE_NAME = 'provider_webhook_events'
                   AND COLUMN_NAME = 'event_category');

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE provider_webhook_events ADD COLUMN event_category VARCHAR(50) NULL AFTER event_type',
    'SELECT "Column event_category already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on event_category for better query performance
SET @index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = @dbname
                     AND TABLE_NAME = 'provider_webhook_events'
                     AND INDEX_NAME = 'idx_event_category');

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE provider_webhook_events ADD INDEX idx_event_category (event_category)',
    'SELECT "Index idx_event_category already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
