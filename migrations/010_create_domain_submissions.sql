-- ===========================================
-- Migration: 010_create_domain_submissions.sql
-- Description: Create domain_submissions table to store original submitted data
-- ===========================================

-- Domain Submissions (stores original payload data for checks)
CREATE TABLE domain_submissions (
  id CHAR(36) PRIMARY KEY,
  domain_id CHAR(36) NOT NULL,

  -- Submitted data (from user/merchant)
  submitted_business_name VARCHAR(255),
  submitted_description TEXT,
  submitted_website VARCHAR(500),
  address_line_1 VARCHAR(255),
  address_line_2 VARCHAR(255),
  city VARCHAR(100),
  state_province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  submitted_email VARCHAR(255),
  submitted_phone VARCHAR(50),
  submitted_full_name VARCHAR(255),

  -- Provider data (from provider response)
  provider_business_name VARCHAR(255),
  provider_industry VARCHAR(255),
  provider_business_type VARCHAR(255),
  provider_founded_year SMALLINT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  INDEX idx_domain_id (domain_id)
);
