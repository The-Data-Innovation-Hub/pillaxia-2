
-- Allow clinicians to view patient roles (needed to list available patients for assignment)
DROP POLICY IF EXISTS "Clinicians can view patient roles" ON public.user_roles;
CREATE POLICY "Clinicians can view patient roles"
ON public.user_roles
FOR SELECT
USING (
  is_clinician(auth.uid()) AND role = 'patient'
);
