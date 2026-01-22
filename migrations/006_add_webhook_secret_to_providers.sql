-- Add webhook secret to providers table
-- This allows each provider to have their own webhook secret for signature verification

ALTER TABLE providers
ADD COLUMN webhook_secret_encrypted VARCHAR(500) NULL AFTER api_key_encrypted;
