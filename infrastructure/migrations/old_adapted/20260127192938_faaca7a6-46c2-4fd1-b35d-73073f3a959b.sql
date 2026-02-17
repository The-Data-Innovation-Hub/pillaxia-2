-- Add license_number column to profiles table for credential tracking
ALTER TABLE public.profiles
ADD COLUMN license_number text;