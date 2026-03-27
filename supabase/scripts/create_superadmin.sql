-- =============================================================================
-- CREATE SUPERADMIN ACCOUNT
-- =============================================================================
-- Run this ONCE in the Supabase SQL Editor after the first user signs up.
--
-- INSTRUCTIONS:
-- 1. First, create an account via the normal signup flow (or Supabase Auth dashboard)
-- 2. Copy the user's email address
-- 3. Replace 'your-admin@email.com' below with the actual email
-- 4. Run this script in the Supabase SQL Editor
-- =============================================================================

-- Step 1: Update the profile to admin role + approved KYC
UPDATE public.profiles
SET 
  role = 'admin',
  kyc_status = 'approved',
  updated_at = now()
WHERE email = 'your-admin@email.com';

-- Verify it worked
SELECT user_id, email, full_name, role, kyc_status 
FROM public.profiles 
WHERE email = 'your-admin@email.com';


-- =============================================================================
-- PROMOTE AN EXISTING USER TO ADMIN (by email)
-- =============================================================================
-- Use this to promote any existing user to admin.
-- Replace 'user-to-promote@email.com' with their email.
-- Only run this from Supabase SQL Editor (superadmin access).
--
-- UPDATE public.profiles
-- SET role = 'admin', kyc_status = 'approved', updated_at = now()
-- WHERE email = 'user-to-promote@email.com';


-- =============================================================================
-- DEMOTE AN ADMIN BACK TO REGULAR USER
-- =============================================================================
-- UPDATE public.profiles
-- SET role = 'complainant', updated_at = now()
-- WHERE email = 'user-to-demote@email.com';


-- =============================================================================
-- VIEW ALL ADMINS
-- =============================================================================
-- SELECT user_id, email, full_name, role, kyc_status, created_at
-- FROM public.profiles
-- WHERE role = 'admin'
-- ORDER BY created_at;
