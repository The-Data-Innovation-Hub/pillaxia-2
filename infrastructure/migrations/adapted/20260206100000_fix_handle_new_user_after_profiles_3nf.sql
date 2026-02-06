-- ============================================================
-- Fix handle_new_user for 3NF profiles (no email column)
-- So new sign-ups from Entra get profile + default role automatically
-- ============================================================
-- After 20260204152820_fix_profiles_table, profiles no longer has
-- email (or organization text). This trigger runs on INSERT into
-- public.users (from API sync via upsert_user_from_jwt).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name TEXT;
  v_last_name  TEXT;
  v_role       public.app_role;
BEGIN
  -- First/last name from Entra JWT (given_name, family_name) or raw_user_meta_data
  v_first_name := COALESCE(
    TRIM(NEW.raw_user_meta_data->>'given_name'),
    TRIM(NEW.raw_user_meta_data->>'first_name'),
    TRIM(SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'name', ''), ' ', 1)),
    'User'
  );
  v_last_name := COALESCE(
    TRIM(NEW.raw_user_meta_data->>'family_name'),
    TRIM(NEW.raw_user_meta_data->>'last_name'),
    TRIM(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'name', '') FROM POSITION(' ' IN COALESCE(NEW.raw_user_meta_data->>'name', ' ') || ' ') FOR 1000)),
    ''
  );
  IF v_last_name = '' THEN
    v_last_name := 'User';
  END IF;

  -- Default role: patient (or from metadata if provided)
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.app_role,
    'patient'::public.app_role
  );

  -- Insert profile (no email – 3NF: email lives on public.users)
  INSERT INTO public.profiles (user_id, first_name, last_name, language_preference, timezone)
  VALUES (NEW.id, v_first_name, v_last_name, 'en', 'UTC')
  ON CONFLICT (user_id) DO NOTHING;

  -- Default role so user can use the app immediately
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates profile and default role for new users synced from Entra (Azure AD B2C). Runs on INSERT into public.users. Compatible with 3NF profiles (no email column).';

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON public.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
