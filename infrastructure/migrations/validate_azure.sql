-- Validation checks for Azure migrations
-- Run with: psql ... -f validate_azure.sql
-- ok is 1 or 0 for reliable parsing

\set ON_ERROR_STOP on

SELECT 'Auth adaptation' AS category, 'public.users table' AS check_name,
  (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'))::int AS ok
UNION ALL
SELECT 'Auth adaptation', 'current_user_id() function',
  (EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'current_user_id'))::int
UNION ALL
SELECT 'Auth adaptation', 'auth.uid() function',
  (EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'auth' AND routine_name = 'uid'))::int
UNION ALL
SELECT 'Auth adaptation', 'upsert_user_from_jwt() function',
  (EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'upsert_user_from_jwt'))::int
UNION ALL
SELECT 'Core schema', 'profiles table',
  (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles'))::int
UNION ALL
SELECT 'Core schema', 'user_roles table',
  (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles'))::int
UNION ALL
SELECT 'Core schema', 'medications table',
  (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medications'))::int
UNION ALL
SELECT '3NF schema', 'medication_catalog table',
  (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medication_catalog'))::int
UNION ALL
SELECT '3NF schema', 'profiles_with_email view',
  (EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'profiles_with_email'))::int
UNION ALL
SELECT 'FK to public.users', 'profiles.user_id -> public.users',
  (EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'profiles' AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'users' AND ccu.table_schema = 'public'
  ))::int;
