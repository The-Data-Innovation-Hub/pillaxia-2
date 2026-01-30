-- Fix PUBLIC_DATA_EXPOSURE: Restrict pharmacy_locations to authenticated users only
-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Everyone can view active pharmacies" ON public.pharmacy_locations;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view active pharmacies"
ON public.pharmacy_locations
FOR SELECT
TO authenticated
USING (is_active = true);

-- Note: Existing policies for pharmacists and admins remain unchanged:
-- - "Pharmacists can manage their own pharmacy"
-- - "Admins can manage all pharmacies"
-- These provide appropriate write access to authorized users