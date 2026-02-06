-- Add job_title column to profiles for clinician/admin profile editing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
