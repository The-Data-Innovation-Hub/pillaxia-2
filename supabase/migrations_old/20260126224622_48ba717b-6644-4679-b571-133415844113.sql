-- =============================================
-- PILLAXIA PHASE 1: Foundation & Infrastructure
-- =============================================

-- 1. Create role enum type
CREATE TYPE public.app_role AS ENUM ('patient', 'clinician', 'pharmacist', 'admin');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  organization TEXT,
  language_preference TEXT DEFAULT 'en',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 4. Create audit_log table for tracking sensitive actions
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create clinician_patient_assignments table
CREATE TABLE public.clinician_patient_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE (clinician_user_id, patient_user_id),
  CHECK (clinician_user_id != patient_user_id)
);

-- 6. Create caregiver_invitations table
CREATE TABLE public.caregiver_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  caregiver_email TEXT NOT NULL,
  caregiver_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  permissions JSONB DEFAULT '{"view_medications": true, "view_adherence": true, "view_symptoms": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (patient_user_id != caregiver_user_id)
);

-- =============================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is a patient
CREATE OR REPLACE FUNCTION public.is_patient(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'patient')
$$;

-- Check if user is a clinician
CREATE OR REPLACE FUNCTION public.is_clinician(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'clinician')
$$;

-- Check if user is a pharmacist
CREATE OR REPLACE FUNCTION public.is_pharmacist(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'pharmacist')
$$;

-- Check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Check if clinician is assigned to patient
CREATE OR REPLACE FUNCTION public.is_clinician_assigned(_patient_user_id UUID, _clinician_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinician_patient_assignments
    WHERE patient_user_id = _patient_user_id
      AND clinician_user_id = _clinician_user_id
  )
$$;

-- Check if user is an approved caregiver for patient
CREATE OR REPLACE FUNCTION public.is_caregiver_for_patient(_patient_user_id UUID, _caregiver_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.caregiver_invitations
    WHERE patient_user_id = _patient_user_id
      AND caregiver_user_id = _caregiver_user_id
      AND status = 'accepted'
  )
$$;

-- Get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- =============================================
-- AUTOMATIC PROFILE CREATION TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Default new users to patient role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_caregiver_invitations_updated_at
  BEFORE UPDATE ON public.caregiver_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUDIT LOGGING TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, target_table, target_id, details)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add audit triggers to sensitive tables
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_clinician_patient_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.clinician_patient_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_invitations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: PROFILES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Clinicians can view assigned patient profiles
CREATE POLICY "Clinicians can view assigned patient profiles"
  ON public.profiles FOR SELECT
  USING (public.is_clinician_assigned(user_id, auth.uid()));

-- Caregivers can view patient profiles they care for
CREATE POLICY "Caregivers can view patient profiles"
  ON public.profiles FOR SELECT
  USING (public.is_caregiver_for_patient(user_id, auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- RLS POLICIES: USER_ROLES
-- =============================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Only admins can manage roles
CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- =============================================
-- RLS POLICIES: AUDIT_LOG
-- =============================================

-- Users can view their own audit entries
CREATE POLICY "Users can view own audit logs"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Audit log insert is handled by security definer trigger
CREATE POLICY "System can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- No updates or deletes allowed on audit log
-- (immutable record)

-- =============================================
-- RLS POLICIES: CLINICIAN_PATIENT_ASSIGNMENTS
-- =============================================

-- Clinicians can view their own assignments
CREATE POLICY "Clinicians can view own assignments"
  ON public.clinician_patient_assignments FOR SELECT
  USING (auth.uid() = clinician_user_id);

-- Patients can view who is assigned to them
CREATE POLICY "Patients can view their assignments"
  ON public.clinician_patient_assignments FOR SELECT
  USING (auth.uid() = patient_user_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments"
  ON public.clinician_patient_assignments FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Clinicians can create assignments for themselves
CREATE POLICY "Clinicians can create own assignments"
  ON public.clinician_patient_assignments FOR INSERT
  WITH CHECK (
    public.is_clinician(auth.uid()) 
    AND auth.uid() = clinician_user_id
  );

-- Admins can create any assignment
CREATE POLICY "Admins can create assignments"
  ON public.clinician_patient_assignments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Clinicians can delete their own assignments
CREATE POLICY "Clinicians can delete own assignments"
  ON public.clinician_patient_assignments FOR DELETE
  USING (
    public.is_clinician(auth.uid()) 
    AND auth.uid() = clinician_user_id
  );

-- Admins can delete any assignment
CREATE POLICY "Admins can delete assignments"
  ON public.clinician_patient_assignments FOR DELETE
  USING (public.is_admin(auth.uid()));

-- =============================================
-- RLS POLICIES: CAREGIVER_INVITATIONS
-- =============================================

-- Patients can view their own invitations
CREATE POLICY "Patients can view own caregiver invitations"
  ON public.caregiver_invitations FOR SELECT
  USING (auth.uid() = patient_user_id);

-- Caregivers can view invitations sent to them
CREATE POLICY "Caregivers can view their invitations"
  ON public.caregiver_invitations FOR SELECT
  USING (auth.uid() = caregiver_user_id);

-- Admins can view all invitations
CREATE POLICY "Admins can view all caregiver invitations"
  ON public.caregiver_invitations FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Patients can create invitations
CREATE POLICY "Patients can create caregiver invitations"
  ON public.caregiver_invitations FOR INSERT
  WITH CHECK (
    public.is_patient(auth.uid()) 
    AND auth.uid() = patient_user_id
  );

-- Caregivers can update invitation status (accept/decline)
CREATE POLICY "Caregivers can update invitation status"
  ON public.caregiver_invitations FOR UPDATE
  USING (auth.uid() = caregiver_user_id AND status = 'pending')
  WITH CHECK (auth.uid() = caregiver_user_id AND status IN ('accepted', 'declined'));

-- Patients can revoke invitations
CREATE POLICY "Patients can update own invitations"
  ON public.caregiver_invitations FOR UPDATE
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

-- Patients can delete their invitations
CREATE POLICY "Patients can delete own invitations"
  ON public.caregiver_invitations FOR DELETE
  USING (auth.uid() = patient_user_id);

-- Admins can manage all invitations
CREATE POLICY "Admins can manage all invitations"
  ON public.caregiver_invitations FOR ALL
  USING (public.is_admin(auth.uid()));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX idx_clinician_assignments_clinician ON public.clinician_patient_assignments(clinician_user_id);
CREATE INDEX idx_clinician_assignments_patient ON public.clinician_patient_assignments(patient_user_id);
CREATE INDEX idx_caregiver_invitations_patient ON public.caregiver_invitations(patient_user_id);
CREATE INDEX idx_caregiver_invitations_caregiver ON public.caregiver_invitations(caregiver_user_id);