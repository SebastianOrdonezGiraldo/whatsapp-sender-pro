-- ============================================================================
-- Move admin role from user_metadata to app_metadata
-- ============================================================================
-- One-time data fix: user_metadata is insecure (editable by users).
-- This moves the "role" field to app_metadata (only server-modifiable).
-- ============================================================================

-- Add "role": "admin" to app_metadata for user sebastian789go@gmail.com
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE id = '36dfa7a3-81ba-480f-b1d9-4fe1105f7281';

-- Remove "role" from user_metadata (cleanup)
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE id = '36dfa7a3-81ba-480f-b1d9-4fe1105f7281';

