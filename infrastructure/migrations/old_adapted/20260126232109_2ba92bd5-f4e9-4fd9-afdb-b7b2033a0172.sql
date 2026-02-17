
-- Allow clinicians to view all patient profiles (needed to see available patients for assignment)
DROP POLICY IF EXISTS "Clinicians can view all patient profiles" ON public.profiles;
CREATE POLICY "Clinicians can view all patient profiles"
ON public.profiles
FOR SELECT
USING (
  is_clinician(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = profiles.user_id 
    AND user_roles.role = 'patient'
  )
);
