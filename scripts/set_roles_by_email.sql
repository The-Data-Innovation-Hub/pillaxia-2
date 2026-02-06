-- ============================================================
-- Set roles for specific users by email
-- ============================================================
-- Use when users were created in Entra and got the default
-- 'patient' role from the handle_new_user trigger. This script
-- replaces their role with the correct one.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/set_roles_by_email.sql
--
-- Edit the INSERT below to add/change emails and roles.
-- ============================================================

BEGIN;

-- (email, role) – user must exist in public.users (sign in once first)
CREATE TEMP TABLE IF NOT EXISTS _role_overrides (email TEXT, role_name TEXT);
DELETE FROM _role_overrides;

INSERT INTO _role_overrides (email, role_name) VALUES
  ('clinician@demo.pillaxia.com', 'clinician'),
  ('pharmacist@demo.pillaxia.com', 'pharmacist'),
  ('manager@demo.pillaxia.com', 'manager'),
  ('pillaxia@thedatainnovationhub.com', 'admin');

DO $$
DECLARE
  r RECORD;
  v_user_id UUID;
BEGIN
  FOR r IN
    SELECT LOWER(TRIM(email)) AS email, role_name
    FROM _role_overrides
  LOOP
    SELECT id INTO v_user_id
    FROM public.users
    WHERE LOWER(TRIM(public.users.email)) = r.email
    LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE NOTICE 'Skipping %: no user found (sign in once first).', r.email;
      CONTINUE;
    END IF;

    DELETE FROM public.user_roles WHERE user_id = v_user_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, r.role_name::public.app_role);

    RAISE NOTICE 'Set role % for % (user_id: %)', r.role_name, r.email, v_user_id;
  END LOOP;
END $$;

COMMIT;

\echo 'Done. Users must sign out and sign in again for the new role to apply.'
