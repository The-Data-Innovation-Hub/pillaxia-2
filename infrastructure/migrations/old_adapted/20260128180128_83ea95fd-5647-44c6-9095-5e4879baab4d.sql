-- Allow pharmacists to view profiles of patients and clinicians for prescriptions at their pharmacy
DROP POLICY IF EXISTS "Pharmacists can view prescription patient profiles" ON public.profiles;
CREATE POLICY "Pharmacists can view prescription patient profiles"
ON public.profiles
FOR SELECT
USING (
  is_pharmacist(auth.uid()) AND (
    -- Can view patient profiles for prescriptions at pharmacist's pharmacy
    EXISTS (
      SELECT 1 FROM prescriptions p
      JOIN pharmacy_locations pl ON pl.id = p.pharmacy_id
      WHERE pl.pharmacist_user_id = auth.uid()
        AND (p.patient_user_id = profiles.user_id OR p.clinician_user_id = profiles.user_id)
    )
  )
);