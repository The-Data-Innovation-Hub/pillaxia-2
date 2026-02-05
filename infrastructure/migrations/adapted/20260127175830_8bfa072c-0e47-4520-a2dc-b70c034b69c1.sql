-- Add timezone column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN timezone text DEFAULT 'UTC';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.timezone IS 'IANA timezone identifier (e.g., Africa/Lagos, America/New_York)';