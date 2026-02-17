-- ============================================================
-- FIX 1: Remove overly permissive clinician profile access policy
-- Clinicians should only see profiles of patients they are assigned to
-- ============================================================

-- Drop the overly permissive policy that allows clinicians to view ALL patient profiles
DROP POLICY IF EXISTS "Clinicians can view all patient profiles" ON public.profiles;

-- The existing "Clinicians can view assigned patient profiles" policy remains:
-- This correctly restricts clinician access to only their assigned patients

-- ============================================================
-- FIX 2: Restrict pharmacy_locations access to appropriate users
-- Only patients (searching for pharmacies), pharmacists (managing their own),
-- and admins should have access
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view active pharmacies" ON public.pharmacy_locations;

-- Create a more restrictive policy: patients can view active pharmacies for search purposes
DROP POLICY IF EXISTS "Patients can view active pharmacies" ON public.pharmacy_locations;
CREATE POLICY "Patients can view active pharmacies"
  ON public.pharmacy_locations
  FOR SELECT
  TO authenticated
  USING (
    is_active = true AND 
    (
      -- Patients can view pharmacies to find where to get prescriptions
      public.is_patient(auth.uid()) OR
      -- Pharmacists can view all pharmacies (for transfers, etc.)
      public.is_pharmacist(auth.uid()) OR
      -- Admins can view all pharmacies
      public.is_admin(auth.uid()) OR
      -- Clinicians can view pharmacies when prescribing
      public.is_clinician(auth.uid())
    )
  );