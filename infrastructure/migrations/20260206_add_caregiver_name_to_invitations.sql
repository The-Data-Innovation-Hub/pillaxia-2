-- Add caregiver_name column to caregiver_invitations.
-- This is a legitimate field: when inviting a caregiver by email,
-- the patient enters their name before the caregiver has a profile.
ALTER TABLE public.caregiver_invitations
  ADD COLUMN IF NOT EXISTS caregiver_name TEXT;
