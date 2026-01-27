-- Migration: Add description field to provider_webhook_events table
-- This field stores the description from provider alert data (e.g., flagged_categories[0].description)

ALTER TABLE provider_webhook_events
ADD COLUMN description TEXT NULL
AFTER event_category;

-- Add index for description field (for potential searches)
CREATE INDEX idx_description ON provider_webhook_events(description(255));
