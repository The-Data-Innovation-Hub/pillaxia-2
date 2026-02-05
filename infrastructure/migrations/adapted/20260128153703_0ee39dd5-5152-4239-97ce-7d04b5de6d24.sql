-- Create helper function to check if user is a manager
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'manager'
  )
$$;

-- Create function to check if user is manager of a specific organization
CREATE OR REPLACE FUNCTION public.is_org_manager(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.organization_members om ON om.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'manager'
      AND om.organization_id = _org_id
      AND om.is_active = true
  )
$$;

-- Create function to check if manager can access a user (same org)
CREATE OR REPLACE FUNCTION public.manager_can_access_user(_manager_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members manager_om
    JOIN public.organization_members target_om ON target_om.organization_id = manager_om.organization_id
    WHERE manager_om.user_id = _manager_id
      AND target_om.user_id = _target_user_id
      AND manager_om.is_active = true
      AND target_om.is_active = true
      AND public.is_manager(_manager_id)
  )
$$;

-- Update profiles policy to allow managers to view users in their organization
DROP POLICY IF EXISTS "Managers can view org profiles" ON public.profiles;
CREATE POLICY "Managers can view org profiles" 
ON public.profiles 
FOR SELECT 
USING (public.manager_can_access_user(auth.uid(), id));

-- Allow managers to update profiles in their organization
DROP POLICY IF EXISTS "Managers can update org profiles" ON public.profiles;
CREATE POLICY "Managers can update org profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.manager_can_access_user(auth.uid(), id));

-- Allow managers to view user_roles for their org members
DROP POLICY IF EXISTS "Managers can view org user roles" ON public.user_roles;
CREATE POLICY "Managers can view org user roles" 
ON public.user_roles 
FOR SELECT 
USING (public.manager_can_access_user(auth.uid(), user_id));

-- Allow managers to manage user_roles for their org members (except admin/manager roles)
DROP POLICY IF EXISTS "Managers can insert org user roles" ON public.user_roles;
CREATE POLICY "Managers can insert org user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  public.manager_can_access_user(auth.uid(), user_id)
  AND role NOT IN ('admin', 'manager')
);

DROP POLICY IF EXISTS "Managers can delete org user roles" ON public.user_roles;
CREATE POLICY "Managers can delete org user roles" 
ON public.user_roles 
FOR DELETE 
USING (
  public.manager_can_access_user(auth.uid(), user_id)
  AND role NOT IN ('admin', 'manager')
);

-- Allow managers to view audit logs for their organization
DROP POLICY IF EXISTS "Managers can view org audit logs" ON public.audit_log;
CREATE POLICY "Managers can view org audit logs" 
ON public.audit_log 
FOR SELECT 
USING (public.manager_can_access_user(auth.uid(), user_id));

-- Allow managers to view medications for their org users
DROP POLICY IF EXISTS "Managers can view org medications" ON public.medications;
CREATE POLICY "Managers can view org medications" 
ON public.medications 
FOR SELECT 
USING (public.manager_can_access_user(auth.uid(), user_id));

-- Allow managers to view appointments for their org
DROP POLICY IF EXISTS "Managers can view org appointments" ON public.appointments;
CREATE POLICY "Managers can view org appointments" 
ON public.appointments 
FOR SELECT 
USING (
  public.manager_can_access_user(auth.uid(), patient_user_id) 
  OR public.manager_can_access_user(auth.uid(), clinician_user_id)
);

-- Allow managers to manage organization members in their org
DROP POLICY IF EXISTS "Managers can view org members" ON public.organization_members;
CREATE POLICY "Managers can view org members" 
ON public.organization_members 
FOR SELECT 
USING (
  public.is_manager(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
);

DROP POLICY IF EXISTS "Managers can insert org members" ON public.organization_members;
CREATE POLICY "Managers can insert org members" 
ON public.organization_members 
FOR INSERT 
WITH CHECK (
  public.is_manager(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
  AND org_role = 'member'
);

DROP POLICY IF EXISTS "Managers can update org members" ON public.organization_members;
CREATE POLICY "Managers can update org members" 
ON public.organization_members 
FOR UPDATE 
USING (
  public.is_manager(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
);

DROP POLICY IF EXISTS "Managers can delete org members" ON public.organization_members;
CREATE POLICY "Managers can delete org members" 
ON public.organization_members 
FOR DELETE 
USING (
  public.is_manager(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
  AND org_role = 'member'
);

-- Allow managers to view and update their organization's branding
DROP POLICY IF EXISTS "Managers can view org branding" ON public.organization_branding;
CREATE POLICY "Managers can view org branding" 
ON public.organization_branding 
FOR SELECT 
USING (
  public.is_manager(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
);

DROP POLICY IF EXISTS "Managers can update org branding" ON public.organization_branding;
CREATE POLICY "Managers can update org branding" 
ON public.organization_branding 
FOR UPDATE 
USING (
  public.is_manager(auth.uid()) 
  AND organization_id = public.get_user_organization_id(auth.uid())
);

-- Allow managers to view their organization details
DROP POLICY IF EXISTS "Managers can view own organization" ON public.organizations;
CREATE POLICY "Managers can view own organization" 
ON public.organizations 
FOR SELECT 
USING (
  public.is_manager(auth.uid()) 
  AND id = public.get_user_organization_id(auth.uid())
);

-- Allow managers to update their organization details (except status)
DROP POLICY IF EXISTS "Managers can update own organization" ON public.organizations;
CREATE POLICY "Managers can update own organization" 
ON public.organizations 
FOR UPDATE 
USING (
  public.is_manager(auth.uid()) 
  AND id = public.get_user_organization_id(auth.uid())
);