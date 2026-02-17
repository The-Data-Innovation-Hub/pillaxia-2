-- Fix infinite recursion in organization_members RLS policies
-- The issue is that policies use get_user_organization_id which queries organization_members

-- First, drop the problematic policies on organization_members
DROP POLICY IF EXISTS "Managers can view org members" ON public.organization_members;
DROP POLICY IF EXISTS "Managers can update org members" ON public.organization_members;
DROP POLICY IF EXISTS "Managers can insert org members" ON public.organization_members;
DROP POLICY IF EXISTS "Managers can delete org members" ON public.organization_members;
DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;

-- Create a helper function that bypasses RLS to check user's org membership
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND is_active = true
  )
$$;

-- Create a helper function to check if user is org admin/owner for a specific org
CREATE OR REPLACE FUNCTION public.is_org_admin_for(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND org_role IN ('admin', 'owner')
      AND is_active = true
  )
$$;

-- Create a helper function to check if user is manager for a specific org
CREATE OR REPLACE FUNCTION public.is_manager_for_org(p_user_id uuid, p_org_id uuid)
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
    WHERE ur.user_id = p_user_id
      AND ur.role = 'manager'
      AND om.organization_id = p_org_id
      AND om.is_active = true
  )
$$;

-- Recreate policies using security definer functions that don't cause recursion

-- Users can view their own membership
DROP POLICY IF EXISTS "Users can view own membership" ON public.organization_members;
CREATE POLICY "Users can view own membership"
ON public.organization_members
FOR SELECT
USING (user_id = auth.uid());

-- Users can view other members in their org (using security definer function)
DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;
CREATE POLICY "Members can view org members"
ON public.organization_members
FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
);

-- Org admins/owners can manage members
DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;
CREATE POLICY "Org admins can manage members"
ON public.organization_members
FOR ALL
USING (
  public.is_org_admin_for(auth.uid(), organization_id)
);

-- Managers can manage members in their org
DROP POLICY IF EXISTS "Managers can manage org members" ON public.organization_members;
CREATE POLICY "Managers can manage org members"
ON public.organization_members
FOR ALL
USING (
  public.is_manager_for_org(auth.uid(), organization_id)
);

-- Now fix the organizations table policies that also have recursion issues
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Org owners can update their organization" ON public.organizations;
DROP POLICY IF EXISTS "Managers can view own organization" ON public.organizations;
DROP POLICY IF EXISTS "Managers can update own organization" ON public.organizations;

-- Members can view their organization
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization"
ON public.organizations
FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), id)
);

-- Org owners can update their organization
DROP POLICY IF EXISTS "Org owners can update their organization" ON public.organizations;
CREATE POLICY "Org owners can update their organization"
ON public.organizations
FOR UPDATE
USING (
  public.is_org_admin_for(auth.uid(), id)
);

-- Managers can view and update their organization
DROP POLICY IF EXISTS "Managers can view own organization" ON public.organizations;
CREATE POLICY "Managers can view own organization"
ON public.organizations
FOR SELECT
USING (
  public.is_manager_for_org(auth.uid(), id)
);

DROP POLICY IF EXISTS "Managers can update own organization" ON public.organizations;
CREATE POLICY "Managers can update own organization"
ON public.organizations
FOR UPDATE
USING (
  public.is_manager_for_org(auth.uid(), id)
);

-- Fix organization_branding policies too
DROP POLICY IF EXISTS "Managers can view org branding" ON public.organization_branding;
DROP POLICY IF EXISTS "Managers can update org branding" ON public.organization_branding;
DROP POLICY IF EXISTS "Members can view org branding" ON public.organization_branding;
DROP POLICY IF EXISTS "Org admins can manage branding" ON public.organization_branding;

-- Members can view their org's branding
DROP POLICY IF EXISTS "Members can view org branding" ON public.organization_branding;
CREATE POLICY "Members can view org branding"
ON public.organization_branding
FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
);

-- Org admins can manage branding
DROP POLICY IF EXISTS "Org admins can manage branding" ON public.organization_branding;
CREATE POLICY "Org admins can manage branding"
ON public.organization_branding
FOR ALL
USING (
  public.is_org_admin_for(auth.uid(), organization_id)
);

-- Managers can view and update branding
DROP POLICY IF EXISTS "Managers can view org branding" ON public.organization_branding;
CREATE POLICY "Managers can view org branding"
ON public.organization_branding
FOR SELECT
USING (
  public.is_manager_for_org(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Managers can update org branding" ON public.organization_branding;
CREATE POLICY "Managers can update org branding"
ON public.organization_branding
FOR UPDATE
USING (
  public.is_manager_for_org(auth.uid(), organization_id)
);