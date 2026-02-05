-- Quick diagnostic: what exists in the database?
\echo '=== Current database ==='
SELECT current_database(), current_user;

\echo ''
\echo '=== Tables in public schema ==='
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo ''
\echo '=== Views in public schema ==='
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

\echo ''
\echo '=== Functions in public schema (auth-related) ==='
SELECT routine_name FROM information_schema.routines
WHERE routine_schema IN ('public', 'auth')
AND routine_name IN ('current_user_id', 'uid', 'upsert_user_from_jwt')
ORDER BY routine_schema, routine_name;
