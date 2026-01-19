-- ===========================================
-- Domain Monitor - Update User Roles
-- ===========================================
-- Migration: 002_update_user_roles.sql
-- Description: Updates user roles from [user, admin] to [superadmin, reseller, merchant]
-- ===========================================

-- Step 1: Update the role enum to include new roles alongside old ones
ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'reseller', 'merchant', 'user', 'admin') DEFAULT 'merchant';

-- Step 2: Migrate existing data from old roles to new roles
UPDATE users SET role = 'superadmin' WHERE role = 'admin';
UPDATE users SET role = 'merchant' WHERE role = 'user';

-- Step 3: Remove old role values from enum (all users should now have new roles)
ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'reseller', 'merchant') DEFAULT 'merchant';
