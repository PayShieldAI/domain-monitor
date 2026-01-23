-- ===========================================
-- Migration: 009_update_check_frequency_enum.sql
-- Description: Update check_frequency ENUM values from daily/weekly/monthly to 7/30/90 days
-- ===========================================

-- Update existing data first
-- Map: daily -> 7, weekly -> 30, monthly -> 90
UPDATE domains SET check_frequency = '7' WHERE check_frequency = 'daily';
UPDATE domains SET check_frequency = '30' WHERE check_frequency = 'weekly';
UPDATE domains SET check_frequency = '90' WHERE check_frequency = 'monthly';

-- Alter the ENUM to use the new values
ALTER TABLE domains
MODIFY COLUMN check_frequency ENUM('7', '30', '90') DEFAULT '7';

-- Update next_check_at based on the new frequency values
-- Recalculate next check time for active domains
UPDATE domains
SET next_check_at = DATE_ADD(
  COALESCE(last_checked_at, NOW()),
  INTERVAL CAST(check_frequency AS UNSIGNED) DAY
)
WHERE status = 'active' AND check_frequency IS NOT NULL;
