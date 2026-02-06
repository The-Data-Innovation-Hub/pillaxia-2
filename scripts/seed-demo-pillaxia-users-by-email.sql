-- ============================================================
-- Ensure profile and role for demo.pillaxia.com users (by email)
-- ============================================================
-- Use this when users were created in Microsoft Entra and have
-- already signed in at least once (so public.users has a row with
-- Entra’s user ID and their email). This script looks up each
-- demo email and ensures profile and user_roles exist.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/seed-demo-pillaxia-users-by-email.sql
--
-- See docs/DEMO_USERS.md for the list of emails and passwords.
-- ============================================================

BEGIN;

-- Patient
INSERT INTO public.profiles (id, user_id, first_name, last_name, language_preference, timezone)
SELECT gen_random_uuid(), u.id, 'Demo', 'Patient', 'en', 'UTC'
  FROM public.users u
  WHERE u.email = 'patient@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;

INSERT INTO public.user_roles (id, user_id, role)
SELECT gen_random_uuid(), u.id, 'patient'
  FROM public.users u
  WHERE u.email = 'patient@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

-- Clinician
INSERT INTO public.profiles (id, user_id, first_name, last_name, language_preference, timezone)
SELECT gen_random_uuid(), u.id, 'Demo', 'Clinician', 'en', 'UTC'
  FROM public.users u
  WHERE u.email = 'clinician@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;

INSERT INTO public.user_roles (id, user_id, role)
SELECT gen_random_uuid(), u.id, 'clinician'
  FROM public.users u
  WHERE u.email = 'clinician@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

-- Pharmacist
INSERT INTO public.profiles (id, user_id, first_name, last_name, language_preference, timezone)
SELECT gen_random_uuid(), u.id, 'Demo', 'Pharmacist', 'en', 'UTC'
  FROM public.users u
  WHERE u.email = 'pharmacist@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;

INSERT INTO public.user_roles (id, user_id, role)
SELECT gen_random_uuid(), u.id, 'pharmacist'
  FROM public.users u
  WHERE u.email = 'pharmacist@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

-- Manager
INSERT INTO public.profiles (id, user_id, first_name, last_name, language_preference, timezone)
SELECT gen_random_uuid(), u.id, 'Demo', 'Manager', 'en', 'UTC'
  FROM public.users u
  WHERE u.email = 'manager@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;

INSERT INTO public.user_roles (id, user_id, role)
SELECT gen_random_uuid(), u.id, 'manager'
  FROM public.users u
  WHERE u.email = 'manager@demo.pillaxia.com'
  LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
