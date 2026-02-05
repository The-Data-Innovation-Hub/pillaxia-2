-- ============================================================
-- One-time: Grant admin role to an existing user by email
-- Run AFTER the user has signed in at least once with Entra
-- (so public.users has a row for them).
--
-- 1. Edit the email below if different.
-- 2. Run: psql $DATABASE_URL -f scripts/azure_grant_admin_by_email.sql
-- ============================================================

DO $$
DECLARE
  v_admin_email TEXT := 'admin@demo.pillaxia.com';  -- edit if needed
  v_user_id UUID;
  v_profile_exists BOOLEAN;
  v_org_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM public.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_admin_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %. Have them sign in once with Entra first.', v_admin_email;
  END IF;

  -- Ensure profile exists (minimal row if not)
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user_id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
    INSERT INTO public.profiles (user_id, first_name, last_name, language_preference, organization_id)
    VALUES (
      v_user_id,
      'Admin',
      'User',
      'en',
      v_org_id
    );
    RAISE NOTICE 'Created profile for user %', v_user_id;
  END IF;

  -- Grant admin role if not already present
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Granted admin role to user % (email: %)', v_user_id, v_admin_email;
END $$;
