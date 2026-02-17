-- Add caregiver_name column to caregiver_invitations table
ALTER TABLE public.caregiver_invitations 
ADD COLUMN caregiver_name text;