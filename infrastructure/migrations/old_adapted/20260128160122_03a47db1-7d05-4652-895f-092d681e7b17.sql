-- Add storage policy for organization logo uploads
-- Allow org admins and managers to upload logos to their organization's folder

DROP POLICY IF EXISTS "Org admins can upload organization logos" ON storage.objects;
CREATE POLICY "Org admins can upload organization logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IS NOT NULL AND
  (
    -- Check if user is org admin for this organization
    public.is_org_admin_for(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR
    -- Check if user is a manager in this organization
    public.is_manager_for_org(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- Allow updating (upsert) organization logos
DROP POLICY IF EXISTS "Org admins can update organization logos" ON storage.objects;
CREATE POLICY "Org admins can update organization logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IS NOT NULL AND
  (
    public.is_org_admin_for(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR
    public.is_manager_for_org(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- Allow deleting old organization logos
DROP POLICY IF EXISTS "Org admins can delete organization logos" ON storage.objects;
CREATE POLICY "Org admins can delete organization logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] IS NOT NULL AND
  (
    public.is_org_admin_for(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR
    public.is_manager_for_org(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);