-- Mark consolidated schema as applied without running it
-- The database already has the correct schema from previous successful migrations

-- Insert the consolidated schema filename into schema_migrations
-- This tells the migration system that this migration has already been applied
INSERT INTO public.schema_migrations (filename, applied_at)
VALUES ('00000000000000_consolidated_schema.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- Success message
SELECT 'Consolidated schema marked as applied' AS status;
