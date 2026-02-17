-- Create policy for pharmacists to manage their own locations
DROP POLICY IF EXISTS "Pharmacists can manage their pharmacy locations" ON public.pharmacy_locations;
CREATE POLICY "Pharmacists can manage their pharmacy locations"
ON public.pharmacy_locations
FOR ALL
TO authenticated
USING (
  pharmacist_user_id = auth.uid()
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  pharmacist_user_id = auth.uid()
  OR public.is_admin(auth.uid())
);