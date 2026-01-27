-- Add license expiration date column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN license_expiration_date date;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.license_expiration_date IS 'Expiration date for professional license, used for renewal reminders';