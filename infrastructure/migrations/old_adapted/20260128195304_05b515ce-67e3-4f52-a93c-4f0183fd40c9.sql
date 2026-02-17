-- Fix: Restrict avatar viewing to authenticated users only
-- This is appropriate for a healthcare app where patient privacy is paramount

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- Create a new policy that requires authentication
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');