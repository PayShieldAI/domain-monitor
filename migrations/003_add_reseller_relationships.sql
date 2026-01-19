-- ===========================================
-- Domain Monitor - Add Reseller-Merchant Relationships
-- ===========================================
-- Migration: 003_add_reseller_relationships.sql
-- Description: Creates table for mapping resellers to merchants
-- ===========================================

-- Create reseller_merchant_relationships table
CREATE TABLE IF NOT EXISTS reseller_merchant_relationships (
  id CHAR(36) PRIMARY KEY,
  reseller_id CHAR(36) NOT NULL,
  merchant_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (reseller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reseller_merchant (reseller_id, merchant_id),
  INDEX idx_reseller (reseller_id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
