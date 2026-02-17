-- Enable required extensions for cron jobs
-- NOTE: pg_cron and pg_net are not available in Azure PostgreSQL
-- Commenting out to allow deployment. If cron jobs are needed,
-- they should be implemented using Azure Functions or other Azure services.

-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT 1; -- Dummy statement to ensure migration is not empty