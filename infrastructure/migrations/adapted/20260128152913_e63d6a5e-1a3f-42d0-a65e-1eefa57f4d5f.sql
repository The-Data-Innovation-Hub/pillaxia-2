-- ==========================================
-- MULTI-TENANCY & WHITE-LABELING SCHEMA
-- ==========================================

-- Create organization status enum
CREATE TYPE public.organization_status AS ENUM ('active', 'suspended', 'trial', 'cancelled');

-- Create organization role enum for org-level permissions
CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'member');

-- ==========================================
-- ORGANIZATIONS TABLE
-- ==========================================
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier (e.g., "lagos-general-hospital")
  description TEXT,
  status organization_status NOT NULL DEFAULT 'trial',
  license_type TEXT DEFAULT 'standard', -- standard, premium, enterprise
  max_users INTEGER DEFAULT 50,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Nigeria',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ORGANIZATION BRANDING TABLE (White-labeling)
-- ==========================================
CREATE TABLE public.organization_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  
  -- Core branding
  app_name TEXT NOT NULL DEFAULT 'Pillaxia',
  logo_url TEXT,
  logo_dark_url TEXT, -- Logo for dark mode
  favicon_url TEXT,
  
  -- Color scheme (HSL values for CSS custom properties)
  primary_color TEXT DEFAULT '244 69% 31%', -- Default Pillaxia blue
  secondary_color TEXT DEFAULT '280 100% 70%',
  accent_color TEXT DEFAULT '174 72% 40%',
  
  -- Additional theming
  font_family TEXT DEFAULT 'Inter, sans-serif',
  border_radius TEXT DEFAULT '0.5rem',
  
  -- Custom content
  support_email TEXT,
  support_phone TEXT,
  terms_url TEXT,
  privacy_url TEXT,
  
  -- Email branding
  email_header_color TEXT,
  email_footer_text TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_branding ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ORGANIZATION MEMBERS TABLE (linking users to orgs)
-- ==========================================
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_role organization_role NOT NULL DEFAULT 'member',
  invited_by UUID,
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = p_user_id
    AND is_active = true
  LIMIT 1
$$;

-- Check if user is in same organization as another user
CREATE OR REPLACE FUNCTION public.is_same_organization(p_user_id_a UUID, p_user_id_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members oma
    JOIN public.organization_members omb ON oma.organization_id = omb.organization_id
    WHERE oma.user_id = p_user_id_a
      AND omb.user_id = p_user_id_b
      AND oma.is_active = true
      AND omb.is_active = true
  )
$$;

-- Check if user has specific org role
CREATE OR REPLACE FUNCTION public.has_org_role(p_user_id UUID, p_role organization_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND org_role = p_role
      AND is_active = true
  )
$$;

-- Check if user is org admin or owner
CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND org_role IN ('admin', 'owner')
      AND is_active = true
  )
$$;

-- Check if user can access organization
CREATE OR REPLACE FUNCTION public.can_access_organization(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN
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
  ) OR public.is_admin(p_user_id) -- Platform admins can access all orgs
$$;

-- ==========================================
-- RLS POLICIES FOR ORGANIZATIONS
-- ==========================================

-- Users can view their own organization
CREATE POLICY "Members can view their organization"
ON public.organizations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.is_active = true
  )
);

-- Platform admins can view all organizations
CREATE POLICY "Platform admins can view all organizations"
ON public.organizations
FOR SELECT
USING (is_admin(auth.uid()));

-- Platform admins can manage all organizations
CREATE POLICY "Platform admins can manage organizations"
ON public.organizations
FOR ALL
USING (is_admin(auth.uid()));

-- Org owners can update their organization
CREATE POLICY "Org owners can update their organization"
ON public.organizations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.org_role = 'owner'
      AND organization_members.is_active = true
  )
);

-- ==========================================
-- RLS POLICIES FOR ORGANIZATION BRANDING
-- ==========================================

-- Members can view their org's branding
CREATE POLICY "Members can view org branding"
ON public.organization_branding
FOR SELECT
USING (can_access_organization(auth.uid(), organization_id));

-- Org admins can update branding
CREATE POLICY "Org admins can manage branding"
ON public.organization_branding
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = organization_branding.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.org_role IN ('admin', 'owner')
      AND organization_members.is_active = true
  )
);

-- Platform admins can manage all branding
CREATE POLICY "Platform admins can manage all branding"
ON public.organization_branding
FOR ALL
USING (is_admin(auth.uid()));

-- ==========================================
-- RLS POLICIES FOR ORGANIZATION MEMBERS
-- ==========================================

-- Members can view other members in their org
CREATE POLICY "Members can view org members"
ON public.organization_members
FOR SELECT
USING (
  can_access_organization(auth.uid(), organization_id)
);

-- Org admins can manage members
CREATE POLICY "Org admins can manage members"
ON public.organization_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.org_role IN ('admin', 'owner')
      AND om.is_active = true
  )
);

-- Platform admins can manage all members
CREATE POLICY "Platform admins can manage all members"
ON public.organization_members
FOR ALL
USING (is_admin(auth.uid()));

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_branding_updated_at
BEFORE UPDATE ON public.organization_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- ADD organization_id TO PROFILES TABLE
-- ==========================================

ALTER TABLE public.profiles
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_organization_id ON public.organization_members(organization_id);
CREATE INDEX idx_organizations_slug ON public.organizations(slug);