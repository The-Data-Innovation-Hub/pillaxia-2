-- Enable required extensions for cron jobs (skip if not available in Azure)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION
  WHEN insufficient_privilege OR invalid_parameter_value THEN
    RAISE NOTICE 'pg_cron extension not available (Azure restriction) - skipping';
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION
  WHEN insufficient_privilege OR invalid_parameter_value OR undefined_file THEN
    RAISE NOTICE 'pg_net extension not available - skipping';
END $$;