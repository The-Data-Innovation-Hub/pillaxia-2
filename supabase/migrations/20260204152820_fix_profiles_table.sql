-- ============================================================
-- PHASE 2: Fix profiles table - Remove redundant columns
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Create backward compatibility view before removing columns
-- This allows applications to continue working during migration
-- ============================================================

CREATE OR REPLACE VIEW public.profiles_with_email AS
SELECT 
  p.id,
  p.user_id,
  p.first_name,
  p.last_name,
  u.email, -- From auth.users
  p.phone,
  p.organization_id,
  o.name AS organization, -- From organizations table
  p.language_preference,
  p.avatar_url,
  p.created_at,
  p.updated_at
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
LEFT JOIN public.organizations o ON p.organization_id = o.id;

-- Grant access to the view
GRANT SELECT ON public.profiles_with_email TO authenticated;

-- ============================================================
-- Step 2: Remove redundant columns from profiles table
-- ============================================================

-- Remove email column (duplicates auth.users.email)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- Remove organization TEXT column (redundant with organization_id)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS organization;

-- Add comments documenting the change
COMMENT ON TABLE public.profiles IS 
  'User profiles. Email is available via auth.users.email join. Organization via organization_id FK. Part of 3NF compliance.';

COMMENT ON COLUMN public.profiles.organization_id IS 
  'References organizations table. Use join to get organization name. Part of 3NF compliance.';
