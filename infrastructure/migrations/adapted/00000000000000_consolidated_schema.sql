--
-- PostgreSQL database dump
--

\restrict qJO2qalKoasfdb70dA14FWzTc69rKqg7Hi5J3EUPnBB01v4LmAMw4E4t0IDJNUM

-- Dumped from database version 15.15
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS auth;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'patient',
    'clinician',
    'pharmacist',
    'admin',
    'manager'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


--
-- Name: drug_schedule; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  CREATE TYPE public.drug_schedule AS ENUM (
    'II',
    'III',
    'IV',
    'V'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


--
-- Name: organization_role; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  CREATE TYPE public.organization_role AS ENUM (
    'owner',
    'admin',
    'member'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


--
-- Name: organization_status; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  CREATE TYPE public.organization_status AS ENUM (
    'active',
    'suspended',
    'trial',
    'cancelled'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


--
-- Name: security_event_type; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  CREATE TYPE public.security_event_type AS ENUM (
    'login_success',
    'login_failure',
    'logout',
    'password_change',
    'password_reset_request',
    'mfa_enabled',
    'mfa_disabled',
    'session_timeout',
    'concurrent_session_blocked',
    'suspicious_activity',
    'data_export',
    'data_access',
    'permission_change',
    'account_locked',
    'account_unlocked',
    'new_login_location'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'trialing',
    'past_due',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid',
    'paused'
);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT public.current_user_id();
$$;


--
-- Name: auto_link_alert_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.auto_link_alert_catalog() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.medication_catalog_id IS NULL AND NEW.medication_name IS NOT NULL AND NEW.medication_name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE LOWER(mc.name) = LOWER(NEW.medication_name)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: auto_link_availability_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.auto_link_availability_catalog() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.medication_catalog_id IS NULL AND NEW.medication_name IS NOT NULL AND NEW.medication_name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE mc.name = NEW.medication_name
      AND mc.dosage = COALESCE(NEW.dosage, '')
      AND mc.form = COALESCE(NEW.form, 'tablet')
    LIMIT 1;

    -- Create catalog entry if missing
    IF NEW.medication_catalog_id IS NULL THEN
      INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
      VALUES (
        NEW.medication_name,
        COALESCE(NEW.generic_name, ''),
        COALESCE(NEW.dosage, ''),
        'mg',
        COALESCE(NEW.form, 'tablet')
      )
      ON CONFLICT (name, dosage, dosage_unit, form) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO NEW.medication_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: auto_link_medication_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.auto_link_medication_catalog() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If medication_catalog_id is not provided, try to find it from text fields
  IF NEW.medication_catalog_id IS NULL AND NEW.name IS NOT NULL AND NEW.name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE mc.name = NEW.name
      AND mc.dosage = NEW.dosage
      AND mc.dosage_unit = COALESCE(NEW.dosage_unit, 'mg')
      AND mc.form = COALESCE(NEW.form, 'tablet')
    LIMIT 1;

    -- If no catalog entry exists, create one
    IF NEW.medication_catalog_id IS NULL THEN
      INSERT INTO public.medication_catalog (name, dosage, dosage_unit, form)
      VALUES (NEW.name, NEW.dosage, COALESCE(NEW.dosage_unit, 'mg'), COALESCE(NEW.form, 'tablet'))
      ON CONFLICT (name, dosage, dosage_unit, form) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO NEW.medication_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: auto_link_transfer_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.auto_link_transfer_catalog() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.medication_catalog_id IS NULL AND NEW.drug_name IS NOT NULL AND NEW.drug_name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE mc.name = NEW.drug_name
      AND mc.dosage = COALESCE(NEW.dosage, '')
      AND mc.form = COALESCE(NEW.form, 'tablet')
    LIMIT 1;

    -- Create catalog entry if missing
    IF NEW.medication_catalog_id IS NULL THEN
      INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
      VALUES (
        NEW.drug_name,
        COALESCE(NEW.generic_name, ''),
        COALESCE(NEW.dosage, ''),
        'mg',
        COALESCE(NEW.form, 'tablet')
      )
      ON CONFLICT (name, dosage, dosage_unit, form) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO NEW.medication_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: backfill_medications_catalog_fk(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.backfill_medications_catalog_fk() RETURNS TABLE(matched integer, unmatched integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_matched INTEGER := 0;
  v_unmatched INTEGER := 0;
BEGIN
  -- First, ensure catalog entries exist for all unique medication combos
  INSERT INTO public.medication_catalog (name, dosage, dosage_unit, form)
  SELECT DISTINCT m.name, m.dosage, m.dosage_unit, m.form
  FROM public.medications m
  WHERE m.medication_catalog_id IS NULL
    AND m.name IS NOT NULL AND m.name != ''
  ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;

  -- Link medications to catalog entries
  UPDATE public.medications m
  SET medication_catalog_id = (
    SELECT mc.id
    FROM public.medication_catalog mc
    WHERE mc.name = m.name
      AND mc.dosage = m.dosage
      AND mc.dosage_unit = m.dosage_unit
      AND mc.form = m.form
    LIMIT 1
  )
  WHERE m.medication_catalog_id IS NULL
    AND m.name IS NOT NULL AND m.name != '';

  GET DIAGNOSTICS v_matched = ROW_COUNT;

  SELECT COUNT(*) INTO v_unmatched
  FROM public.medications
  WHERE medication_catalog_id IS NULL
    AND name IS NOT NULL AND name != '';

  RETURN QUERY SELECT v_matched, v_unmatched;
END;
$$;


--
-- Name: can_access_organization(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.can_access_organization(p_user_id uuid, p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND is_active = true
  ) OR public.is_admin(p_user_id) -- Platform admins can access all orgs
$$;


--
-- Name: check_account_locked(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.check_account_locked(p_email text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lockout RECORD;
BEGIN
  SELECT * INTO v_lockout
  FROM public.account_lockouts
  WHERE email = p_email
    AND locked_until > now()
    AND unlocked_at IS NULL;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', v_lockout.locked_until,
      'failed_attempts', v_lockout.failed_attempts,
      'minutes_remaining', EXTRACT(EPOCH FROM (v_lockout.locked_until - now())) / 60
    );
  ELSE
    -- Clean up expired lockouts
    DELETE FROM public.account_lockouts 
    WHERE email = p_email AND locked_until <= now();
    
    RETURN jsonb_build_object('locked', false);
  END IF;
END;
$$;


--
-- Name: check_medication_schedules_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.check_medication_schedules_integrity() RETURNS TABLE(orphaned_schedules integer, schedules_with_mismatched_user_id integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_orphaned INTEGER := 0;
  v_mismatched INTEGER := 0;
BEGIN
  -- Count schedules without matching medications
  SELECT COUNT(*) INTO v_orphaned
  FROM public.medication_schedules ms
  WHERE NOT EXISTS (
    SELECT 1 FROM public.medications m WHERE m.id = ms.medication_id
  );
  -- Second column deprecated after user_id removal; always 0
  RETURN QUERY SELECT v_orphaned, v_mismatched;
END;
$$;


--
-- Name: check_session_limits(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.check_session_limits(p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_max_sessions INTEGER;
  v_current_sessions INTEGER;
BEGIN
  -- Get max concurrent sessions setting
  SELECT (setting_value->>'value')::INTEGER INTO v_max_sessions
  FROM public.security_settings
  WHERE setting_key = 'max_concurrent_sessions';
  
  -- Default to 3 if not set
  v_max_sessions := COALESCE(v_max_sessions, 3);
  
  -- Count active sessions
  SELECT COUNT(*) INTO v_current_sessions
  FROM public.user_sessions
  WHERE user_id = p_user_id AND is_active = true AND expires_at > now();
  
  RETURN v_current_sessions < v_max_sessions;
END;
$$;


--
-- Name: count_org_seats_used(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.count_org_seats_used(p_org_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND is_active = true
$$;


--
-- Name: current_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_oid TEXT;
  v_sub TEXT;
BEGIN
  BEGIN
    v_oid := current_setting('request.jwt.claims', true)::json->>'oid';
    v_sub := current_setting('request.jwt.claims', true)::json->>'sub';
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  -- Try oid first (Azure AD B2C object ID)
  IF v_oid IS NOT NULL AND v_oid != '' THEN
    BEGIN
      RETURN v_oid::UUID;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Fallback to sub claim
  IF v_sub IS NOT NULL AND v_sub != '' THEN
    BEGIN
      RETURN v_sub::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: generate_prescription_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.generate_prescription_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  prefix TEXT := 'RX';
  date_part TEXT := to_char(CURRENT_DATE, 'YYMMDD');
  random_part TEXT := lpad(floor(random() * 10000)::text, 4, '0');
  new_number TEXT;
BEGIN
  new_number := prefix || date_part || random_part;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.prescriptions WHERE prescription_number = new_number) LOOP
    random_part := lpad(floor(random() * 10000)::text, 4, '0');
    new_number := prefix || date_part || random_part;
  END LOOP;
  
  RETURN new_number;
END;
$$;


--
-- Name: get_user_organization_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_user_organization_id(p_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = p_user_id
    AND is_active = true
  LIMIT 1
$$;


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid) RETURNS SETOF public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  selected_role app_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  
  -- Get role from metadata, default to 'patient' if not provided
  selected_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'patient'::app_role
  );
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, selected_role);
  
  RETURN NEW;
END;
$$;


--
-- Name: has_org_role(uuid, public.organization_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.has_org_role(p_user_id uuid, p_role public.organization_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND org_role = p_role
      AND is_active = true
  )
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;


--
-- Name: is_caregiver_for_patient(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_caregiver_for_patient(_patient_user_id uuid, _caregiver_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.caregiver_invitations
    WHERE patient_user_id = _patient_user_id
      AND caregiver_user_id = _caregiver_user_id
      AND status = 'accepted'
  )
$$;


--
-- Name: is_clinician(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_clinician(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id, 'clinician')
$$;


--
-- Name: is_clinician_assigned(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_clinician_assigned(_patient_user_id uuid, _clinician_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinician_patient_assignments
    WHERE patient_user_id = _patient_user_id
      AND clinician_user_id = _clinician_user_id
  )
$$;


--
-- Name: is_device_trusted(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_device_trusted(p_user_id uuid, p_device_token_hash text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_trusted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.trusted_devices
    WHERE user_id = p_user_id
      AND device_token_hash = p_device_token_hash
      AND is_active = true
      AND expires_at > now()
  ) INTO v_is_trusted;
  
  -- Update last_used_at if trusted
  IF v_is_trusted THEN
    UPDATE public.trusted_devices
    SET last_used_at = now()
    WHERE user_id = p_user_id
      AND device_token_hash = p_device_token_hash
      AND is_active = true;
  END IF;
  
  RETURN v_is_trusted;
END;
$$;


--
-- Name: is_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'manager'
  )
$$;


--
-- Name: is_manager_for_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_manager_for_org(p_user_id uuid, p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: is_org_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND org_role IN ('admin', 'owner')
      AND is_active = true
  )
$$;


--
-- Name: is_org_admin_for(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_org_admin_for(p_user_id uuid, p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: is_org_manager(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_org_manager(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: is_patient(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_patient(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id, 'patient')
$$;


--
-- Name: is_pharmacist(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_pharmacist(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id, 'pharmacist')
$$;


--
-- Name: is_same_organization(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.is_same_organization(p_user_id_a uuid, p_user_id_b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: log_audit_event(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_audit_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: log_controlled_drug_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_controlled_drug_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Log every SELECT access to controlled drugs for compliance
  INSERT INTO public.data_access_log (
    user_id,
    accessed_table,
    accessed_record_id,
    access_type,
    data_category,
    reason
  ) VALUES (
    auth.uid(),
    'controlled_drugs',
    NEW.id,
    'SELECT',
    'controlled_substance',
    'Controlled drug inventory access'
  );
  RETURN NEW;
END;
$$;


--
-- Name: log_data_access(uuid, text, uuid, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_data_access(p_user_id uuid, p_accessed_table text, p_accessed_record_id uuid, p_access_type text, p_data_category text DEFAULT 'general'::text, p_patient_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_access_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  
  -- SECURITY: Users can only log their own data access
  -- System/admin can log for any user
  -- Allow NULL caller for system triggers
  IF v_caller_id IS NOT NULL AND p_user_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
    RAISE EXCEPTION 'Cannot log data access for another user';
  END IF;

  INSERT INTO public.data_access_log (
    user_id, accessed_table, accessed_record_id, access_type,
    data_category, patient_id, reason
  ) VALUES (
    p_user_id, p_accessed_table, p_accessed_record_id, p_access_type,
    p_data_category, p_patient_id, p_reason
  )
  RETURNING id INTO v_access_id;
  
  RETURN v_access_id;
END;
$$;


--
-- Name: log_security_event(uuid, public.security_event_type, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.log_security_event(p_user_id uuid, p_event_type public.security_event_type, p_event_category text DEFAULT 'authentication'::text, p_severity text DEFAULT 'info'::text, p_description text DEFAULT NULL::text, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_event_id UUID;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  
  -- SECURITY: Users can only log events for themselves
  -- System/admin can log for any user (when p_user_id differs)
  -- Allow NULL caller for system triggers
  IF v_caller_id IS NOT NULL AND p_user_id != v_caller_id AND NOT public.is_admin(v_caller_id) THEN
    RAISE EXCEPTION 'Cannot log security events for another user';
  END IF;

  INSERT INTO public.security_events (
    user_id, event_type, event_category, severity, 
    description, ip_address, user_agent, metadata
  ) VALUES (
    p_user_id, p_event_type, p_event_category, p_severity,
    p_description, p_ip_address, p_user_agent, p_metadata
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;


--
-- Name: manager_can_access_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.manager_can_access_user(_manager_id uuid, _target_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: migrate_controlled_drug_dispensing_to_fks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.migrate_controlled_drug_dispensing_to_fks() RETURNS TABLE(patient_matched integer, prescriber_matched integer, prescription_matched integer, patient_unmatched integer, prescriber_unmatched integer, prescription_unmatched integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_patient_matched INTEGER := 0;
  v_prescriber_matched INTEGER := 0;
  v_prescription_matched INTEGER := 0;
  v_patient_unmatched INTEGER := 0;
  v_prescriber_unmatched INTEGER := 0;
  v_prescription_unmatched INTEGER := 0;
BEGIN
  -- Migrate patient_name to patient_user_id
  -- Try to match by name in profiles
  UPDATE public.controlled_drug_dispensing cdd
  SET patient_user_id = (
    SELECT p.user_id
    FROM public.profiles p
    WHERE LOWER(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')))) = LOWER(TRIM(cdd.patient_name))
    LIMIT 1
  )
  WHERE cdd.patient_name IS NOT NULL 
    AND cdd.patient_name != ''
    AND cdd.patient_user_id IS NULL;
  
  GET DIAGNOSTICS v_patient_matched = ROW_COUNT;
  
  -- Count unmatched patients
  SELECT COUNT(*) INTO v_patient_unmatched
  FROM public.controlled_drug_dispensing
  WHERE patient_name IS NOT NULL 
    AND patient_name != ''
    AND patient_user_id IS NULL;
  
  -- Migrate prescriber_name to prescriber_user_id
  -- Try to match by name in profiles (clinicians)
  UPDATE public.controlled_drug_dispensing cdd
  SET prescriber_user_id = (
    SELECT p.user_id
    FROM public.profiles p
    JOIN public.user_roles ur ON p.user_id = ur.user_id
    WHERE LOWER(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')))) = LOWER(TRIM(cdd.prescriber_name))
      AND ur.role = 'clinician'
    LIMIT 1
  )
  WHERE cdd.prescriber_name IS NOT NULL 
    AND cdd.prescriber_name != ''
    AND cdd.prescriber_user_id IS NULL;
  
  GET DIAGNOSTICS v_prescriber_matched = ROW_COUNT;
  
  -- Count unmatched prescribers
  SELECT COUNT(*) INTO v_prescriber_unmatched
  FROM public.controlled_drug_dispensing
  WHERE prescriber_name IS NOT NULL 
    AND prescriber_name != ''
    AND prescriber_user_id IS NULL;
  
  -- Migrate prescription_number to prescription_id
  UPDATE public.controlled_drug_dispensing cdd
  SET prescription_id = (
    SELECT p.id
    FROM public.prescriptions p
    WHERE p.prescription_number = cdd.prescription_number
    LIMIT 1
  )
  WHERE cdd.prescription_number IS NOT NULL 
    AND cdd.prescription_number != ''
    AND cdd.prescription_id IS NULL;
  
  GET DIAGNOSTICS v_prescription_matched = ROW_COUNT;
  
  -- Count unmatched prescriptions
  SELECT COUNT(*) INTO v_prescription_unmatched
  FROM public.controlled_drug_dispensing
  WHERE prescription_number IS NOT NULL 
    AND prescription_number != ''
    AND prescription_id IS NULL;
  
  RETURN QUERY SELECT 
    v_patient_matched,
    v_prescriber_matched,
    v_prescription_matched,
    v_patient_unmatched,
    v_prescriber_unmatched,
    v_prescription_unmatched;
END;
$$;


--
-- Name: migrate_drug_transfers_to_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.migrate_drug_transfers_to_catalog() RETURNS TABLE(catalog_entries_created integer, transfers_migrated integer, unmatched_records integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_catalog_created INTEGER := 0;
  v_migrated INTEGER := 0;
  v_unmatched INTEGER := 0;
BEGIN
  -- First, create catalog entries from unique medication combinations
  INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
  SELECT DISTINCT
    drug_name,
    generic_name,
    COALESCE(dosage, ''),
    'mg', -- Default
    COALESCE(form, 'tablet')
  FROM public.drug_transfers
  WHERE medication_catalog_id IS NULL
    AND drug_name IS NOT NULL
    AND drug_name != ''
  ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;
  
  GET DIAGNOSTICS v_catalog_created = ROW_COUNT;
  
  -- Now link transfer records to catalog entries
  UPDATE public.drug_transfers dt
  SET medication_catalog_id = (
    SELECT mc.id
    FROM public.medication_catalog mc
    WHERE mc.name = dt.drug_name
      AND mc.dosage = COALESCE(dt.dosage, '')
      AND mc.form = COALESCE(dt.form, 'tablet')
    LIMIT 1
  )
  WHERE dt.medication_catalog_id IS NULL
    AND dt.drug_name IS NOT NULL
    AND dt.drug_name != '';
  
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  
  -- Count unmatched records
  SELECT COUNT(*) INTO v_unmatched
  FROM public.drug_transfers
  WHERE medication_catalog_id IS NULL
    AND drug_name IS NOT NULL
    AND drug_name != '';
  
  RETURN QUERY SELECT 
    v_catalog_created,
    v_migrated,
    v_unmatched;
END;
$$;


--
-- Name: migrate_medication_availability_to_catalog(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.migrate_medication_availability_to_catalog() RETURNS TABLE(catalog_entries_created integer, availability_records_migrated integer, unmatched_records integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_catalog_created INTEGER := 0;
  v_migrated INTEGER := 0;
  v_unmatched INTEGER := 0;
  v_catalog_id UUID;
BEGIN
  -- First, create catalog entries from unique medication combinations
  INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
  SELECT DISTINCT
    medication_name,
    generic_name,
    COALESCE(dosage, ''),
    'mg', -- Default, adjust if needed
    COALESCE(form, 'tablet')
  FROM public.medication_availability
  WHERE medication_catalog_id IS NULL
    AND medication_name IS NOT NULL
    AND medication_name != ''
  ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;
  
  GET DIAGNOSTICS v_catalog_created = ROW_COUNT;
  
  -- Now link availability records to catalog entries
  UPDATE public.medication_availability ma
  SET medication_catalog_id = (
    SELECT mc.id
    FROM public.medication_catalog mc
    WHERE mc.name = ma.medication_name
      AND mc.dosage = COALESCE(ma.dosage, '')
      AND mc.form = COALESCE(ma.form, 'tablet')
    LIMIT 1
  )
  WHERE ma.medication_catalog_id IS NULL
    AND ma.medication_name IS NOT NULL
    AND ma.medication_name != '';
  
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  
  -- Count unmatched records
  SELECT COUNT(*) INTO v_unmatched
  FROM public.medication_availability
  WHERE medication_catalog_id IS NULL
    AND medication_name IS NOT NULL
    AND medication_name != '';
  
  RETURN QUERY SELECT 
    v_catalog_created,
    v_migrated,
    v_unmatched;
END;
$$;


--
-- Name: migrate_medications_text_to_fks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.migrate_medications_text_to_fks() RETURNS TABLE(migrated_count integer, prescriber_matched integer, pharmacy_matched integer, prescriber_unmatched integer, pharmacy_unmatched integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_prescriber_matched INTEGER := 0;
  v_pharmacy_matched INTEGER := 0;
  v_prescriber_unmatched INTEGER := 0;
  v_pharmacy_unmatched INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  -- Migrate prescriber TEXT to prescriber_user_id
  -- Try to match by email first, then by name
  UPDATE public.medications m
  SET prescriber_user_id = (
    SELECT u.id
    FROM public.users u
    JOIN public.profiles p ON u.id = p.user_id
    WHERE (
      LOWER(TRIM(p.first_name || ' ' || COALESCE(p.last_name, ''))) = LOWER(TRIM(m.prescriber))
      OR u.email = m.prescriber
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = u.id AND ur.role = 'clinician'
    )
    LIMIT 1
  )
  WHERE m.prescriber IS NOT NULL 
    AND m.prescriber != ''
    AND m.prescriber_user_id IS NULL;
  
  GET DIAGNOSTICS v_prescriber_matched = ROW_COUNT;
  
  -- Count unmatched prescribers
  SELECT COUNT(*) INTO v_prescriber_unmatched
  FROM public.medications
  WHERE prescriber IS NOT NULL 
    AND prescriber != ''
    AND prescriber_user_id IS NULL;
  
  -- Migrate pharmacy TEXT to pharmacy_id
  -- Match by pharmacy name
  UPDATE public.medications m
  SET pharmacy_id = (
    SELECT pl.id
    FROM public.pharmacy_locations pl
    WHERE LOWER(TRIM(pl.name)) = LOWER(TRIM(m.pharmacy))
    LIMIT 1
  )
  WHERE m.pharmacy IS NOT NULL 
    AND m.pharmacy != ''
    AND m.pharmacy_id IS NULL;
  
  GET DIAGNOSTICS v_pharmacy_matched = ROW_COUNT;
  
  -- Count unmatched pharmacies
  SELECT COUNT(*) INTO v_pharmacy_unmatched
  FROM public.medications
  WHERE pharmacy IS NOT NULL 
    AND pharmacy != ''
    AND pharmacy_id IS NULL;
  
  SELECT COUNT(*) INTO v_total FROM public.medications;
  
  RETURN QUERY SELECT 
    v_total,
    v_prescriber_matched,
    v_pharmacy_matched,
    v_prescriber_unmatched,
    v_pharmacy_unmatched;
END;
$$;


--
-- Name: org_has_available_seats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.org_has_available_seats(p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT seats_purchased > seats_used
     FROM public.organization_subscriptions
     WHERE organization_id = p_org_id
       AND status IN ('active', 'trialing')),
    false
  )
$$;


--
-- Name: record_login_attempt(text, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.record_login_attempt(p_email text, p_success boolean, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_failed_count INTEGER;
  v_lockout_threshold INTEGER := 5;
  v_lockout_duration INTERVAL := '30 minutes';
  v_is_locked BOOLEAN := false;
  v_locked_until TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get user_id if exists
  SELECT id INTO v_user_id FROM public.users WHERE email = p_email;
  
  -- Record the attempt
  INSERT INTO public.login_attempts (email, user_id, success, ip_address, user_agent)
  VALUES (p_email, v_user_id, p_success, p_ip_address, p_user_agent);
  
  IF p_success THEN
    -- On successful login, remove any existing lockout
    DELETE FROM public.account_lockouts WHERE email = p_email;
    RETURN jsonb_build_object('locked', false, 'message', 'Login successful');
  ELSE
    -- Count recent failed attempts (last 30 minutes)
    SELECT COUNT(*) INTO v_failed_count
    FROM public.login_attempts
    WHERE email = p_email
      AND success = false
      AND created_at > now() - v_lockout_duration;
    
    -- Check if we need to lock the account
    IF v_failed_count >= v_lockout_threshold THEN
      v_locked_until := now() + v_lockout_duration;
      
      -- Insert or update lockout record
      INSERT INTO public.account_lockouts (email, user_id, locked_until, failed_attempts)
      VALUES (p_email, v_user_id, v_locked_until, v_failed_count)
      ON CONFLICT (email) DO UPDATE
      SET locked_at = now(),
          locked_until = v_locked_until,
          failed_attempts = v_failed_count,
          unlocked_at = NULL,
          unlocked_by = NULL;
      
      RETURN jsonb_build_object(
        'locked', true,
        'locked_until', v_locked_until,
        'failed_attempts', v_failed_count,
        'message', 'Account locked due to too many failed attempts'
      );
    ELSE
      RETURN jsonb_build_object(
        'locked', false,
        'failed_attempts', v_failed_count,
        'remaining_attempts', v_lockout_threshold - v_failed_count,
        'message', 'Login failed'
      );
    END IF;
  END IF;
END;
$$;


--
-- Name: refresh_all_materialized_views(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Refresh concurrently if index exists, otherwise normal refresh
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.medication_availability_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.medication_availability_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.patient_vitals_with_bmi_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.patient_vitals_with_bmi_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.medications_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.medications_full_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.controlled_drug_dispensing_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.controlled_drug_dispensing_full_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.drug_transfers_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.drug_transfers_full_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_invoices_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.organization_invoices_full_view;
  END;

  RAISE NOTICE 'All materialized views refreshed at %', now();
END;
$$;


--
-- Name: revoke_all_trusted_devices(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.revoke_all_trusted_devices(p_user_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.trusted_devices
  SET is_active = false, revoked_at = now()
  WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: revoke_trusted_device(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.revoke_trusted_device(p_device_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.trusted_devices
  SET is_active = false, revoked_at = now()
  WHERE id = p_device_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;


--
-- Name: trust_device(uuid, text, text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.trust_device(p_user_id uuid, p_device_token_hash text, p_device_name text DEFAULT NULL::text, p_browser text DEFAULT NULL::text, p_os text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_days integer DEFAULT 30) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_device_id UUID;
BEGIN
  -- SECURITY: Validate that the caller is trusting their own device
  -- Users can only trust devices for themselves, admins cannot trust devices for others
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot trust device for another user';
  END IF;

  -- Deactivate any existing trust for this device
  UPDATE public.trusted_devices
  SET is_active = false, revoked_at = now()
  WHERE user_id = p_user_id
    AND device_token_hash = p_device_token_hash
    AND is_active = true;
  
  -- Insert new trusted device
  INSERT INTO public.trusted_devices (
    user_id, device_token_hash, device_name, browser, 
    operating_system, ip_address, expires_at
  ) VALUES (
    p_user_id, p_device_token_hash, p_device_name, p_browser,
    p_os, p_ip, now() + (p_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_device_id;
  
  RETURN v_device_id;
END;
$$;


--
-- Name: unlock_account(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.unlock_account(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can unlock accounts';
  END IF;
  
  UPDATE public.account_lockouts
  SET unlocked_at = now(),
      unlocked_by = auth.uid()
  WHERE email = p_email
    AND unlocked_at IS NULL;
  
  RETURN FOUND;
END;
$$;


--
-- Name: update_controlled_drug_stock_on_adjustment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_controlled_drug_stock_on_adjustment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.controlled_drugs
  SET current_stock = NEW.new_stock,
      updated_at = now()
  WHERE id = NEW.controlled_drug_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_controlled_drug_stock_on_dispense(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_controlled_drug_stock_on_dispense() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.controlled_drugs
  SET current_stock = current_stock - NEW.quantity_dispensed,
      updated_at = now()
  WHERE id = NEW.controlled_drug_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: upsert_user_from_jwt(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.upsert_user_from_jwt(p_id uuid, p_email text DEFAULT NULL::text, p_raw_user_meta_data jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, raw_user_meta_data, updated_at)
  VALUES (p_id, p_email, p_raw_user_meta_data, now())
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.users.email),
    raw_user_meta_data = COALESCE(EXCLUDED.raw_user_meta_data, public.users.raw_user_meta_data),
    updated_at = now();
  RETURN p_id;
END;
$$;


--
-- Name: user_belongs_to_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(p_user_id uuid, p_org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND is_active = true
  )
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_lockouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.account_lockouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    locked_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_until timestamp with time zone NOT NULL,
    failed_attempts integer DEFAULT 5 NOT NULL,
    unlock_token text,
    unlocked_at timestamp with time zone,
    unlocked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    appointment_date date NOT NULL,
    appointment_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    location text,
    reminder_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_video_call boolean DEFAULT false NOT NULL,
    video_room_id uuid,
    CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text, 'no_show'::text])))
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    target_table text,
    target_id uuid,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: availability_notification_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.availability_notification_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_id uuid NOT NULL,
    availability_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    notified_at timestamp with time zone DEFAULT now() NOT NULL,
    channels_used jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: billing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.billing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    event_type text NOT NULL,
    stripe_event_id text,
    description text,
    amount integer,
    currency text DEFAULT 'usd'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caregiver_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.caregiver_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    caregiver_email text NOT NULL,
    caregiver_user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    permissions jsonb DEFAULT '{"view_symptoms": false, "view_adherence": true, "view_medications": true}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    caregiver_name text,
    CONSTRAINT caregiver_invitations_check CHECK ((patient_user_id <> caregiver_user_id)),
    CONSTRAINT caregiver_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'revoked'::text])))
);


--
-- Name: caregiver_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.caregiver_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    caregiver_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sender_type text DEFAULT 'caregiver'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT caregiver_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['caregiver'::text, 'patient'::text])))
);


--
-- Name: clinician_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.clinician_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    message text NOT NULL,
    sender_type text DEFAULT 'clinician'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    delivery_status jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT clinician_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['clinician'::text, 'patient'::text])))
);


--
-- Name: clinician_patient_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.clinician_patient_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    CONSTRAINT clinician_patient_assignments_check CHECK ((clinician_user_id <> patient_user_id))
);


--
-- Name: compliance_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.compliance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_type text NOT NULL,
    report_period_start date NOT NULL,
    report_period_end date NOT NULL,
    generated_by uuid NOT NULL,
    report_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_reports_report_type_check CHECK ((report_type = ANY (ARRAY['access_audit'::text, 'security_audit'::text, 'hipaa_compliance'::text, 'ndpr_compliance'::text, 'data_retention'::text])))
);


--
-- Name: controlled_drug_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.controlled_drug_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    controlled_drug_id uuid NOT NULL,
    adjustment_type text NOT NULL,
    quantity integer NOT NULL,
    previous_stock integer NOT NULL,
    new_stock integer NOT NULL,
    invoice_number text,
    supplier text,
    reason text NOT NULL,
    performed_by uuid NOT NULL,
    witness_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT controlled_drug_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['received'::text, 'return'::text, 'destroyed'::text, 'loss'::text, 'correction'::text])))
);


--
-- Name: controlled_drug_dispensing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.controlled_drug_dispensing (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    controlled_drug_id uuid NOT NULL,
    patient_name text NOT NULL,
    patient_id text,
    prescriber_name text NOT NULL,
    prescriber_dea text,
    prescription_number text NOT NULL,
    quantity_dispensed integer NOT NULL,
    quantity_remaining integer NOT NULL,
    dispensing_pharmacist_id uuid NOT NULL,
    witness_pharmacist_id uuid,
    dispensed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_user_id uuid,
    prescriber_user_id uuid,
    prescription_id uuid,
    CONSTRAINT positive_quantity CHECK ((quantity_dispensed > 0))
);


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.prescriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_number text NOT NULL,
    patient_user_id uuid NOT NULL,
    clinician_user_id uuid NOT NULL,
    pharmacy_id uuid,
    medication_name text NOT NULL,
    generic_name text,
    dosage text NOT NULL,
    dosage_unit text DEFAULT 'mg'::text NOT NULL,
    form text DEFAULT 'tablet'::text NOT NULL,
    quantity integer NOT NULL,
    refills_authorized integer DEFAULT 0 NOT NULL,
    refills_remaining integer DEFAULT 0 NOT NULL,
    sig text NOT NULL,
    instructions text,
    date_written date DEFAULT CURRENT_DATE NOT NULL,
    date_expires date,
    status text DEFAULT 'pending'::text NOT NULL,
    is_controlled_substance boolean DEFAULT false NOT NULL,
    dea_schedule text,
    dispense_as_written boolean DEFAULT false NOT NULL,
    diagnosis_code text,
    diagnosis_description text,
    sent_at timestamp with time zone,
    received_at timestamp with time zone,
    dispensed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT prescriptions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'sent'::text, 'received'::text, 'processing'::text, 'ready'::text, 'dispensed'::text, 'cancelled'::text, 'expired'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name text,
    last_name text,
    phone text,
    language_preference text DEFAULT 'en'::text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    timezone text DEFAULT 'UTC'::text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    postal_code text,
    country text,
    license_number text,
    license_expiration_date date,
    job_title text,
    organization_id uuid
);


--
-- Name: controlled_drug_dispensing_full; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.controlled_drug_dispensing_full AS
 SELECT cdd.id,
    cdd.controlled_drug_id,
    cdd.patient_user_id,
    concat(p.first_name, ' ', COALESCE(p.last_name, ''::text)) AS patient_name,
    cdd.patient_id AS patient_id_text,
    cdd.prescriber_user_id,
    concat(pr.first_name, ' ', COALESCE(pr.last_name, ''::text)) AS prescriber_name,
    cdd.prescriber_dea,
    cdd.prescription_id,
    pres.prescription_number,
    cdd.quantity_dispensed,
    cdd.quantity_remaining,
    cdd.dispensing_pharmacist_id,
    cdd.witness_pharmacist_id,
    cdd.dispensed_at,
    cdd.notes,
    cdd.created_at
   FROM (((public.controlled_drug_dispensing cdd
     LEFT JOIN public.profiles p ON ((cdd.patient_user_id = p.user_id)))
     LEFT JOIN public.profiles pr ON ((cdd.prescriber_user_id = pr.user_id)))
     LEFT JOIN public.prescriptions pres ON ((cdd.prescription_id = pres.id)));


--
-- Name: controlled_drugs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.controlled_drugs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    generic_name text,
    schedule public.drug_schedule NOT NULL,
    form text DEFAULT 'tablet'::text NOT NULL,
    strength text NOT NULL,
    manufacturer text,
    ndc_number text,
    current_stock integer DEFAULT 0 NOT NULL,
    minimum_stock integer DEFAULT 10 NOT NULL,
    unit_of_measure text DEFAULT 'units'::text NOT NULL,
    storage_location text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    expiry_date date,
    lot_number text,
    expiry_alert_sent boolean DEFAULT false NOT NULL,
    CONSTRAINT positive_stock CHECK ((current_stock >= 0))
);


--
-- Name: controlled_drug_dispensing_full_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.controlled_drug_dispensing_full_view AS
 SELECT cdd.id,
    cdd.controlled_drug_id,
    cd.name AS controlled_drug_name,
    cd.schedule AS controlled_drug_schedule,
    cdd.patient_user_id,
    ((p.first_name || ' '::text) || COALESCE(p.last_name, ''::text)) AS patient_name,
    cdd.patient_id AS patient_id_text,
    cdd.prescriber_user_id,
    ((pres.first_name || ' '::text) || COALESCE(pres.last_name, ''::text)) AS prescriber_name,
    cdd.prescriber_dea,
    cdd.prescription_id,
    presc.prescription_number,
    cdd.quantity_dispensed,
    cdd.quantity_remaining,
    cdd.dispensing_pharmacist_id,
    ((pharm.first_name || ' '::text) || COALESCE(pharm.last_name, ''::text)) AS dispensing_pharmacist_name,
    cdd.witness_pharmacist_id,
    ((witness.first_name || ' '::text) || COALESCE(witness.last_name, ''::text)) AS witness_pharmacist_name,
    cdd.dispensed_at,
    cdd.notes,
    cdd.created_at
   FROM ((((((public.controlled_drug_dispensing cdd
     LEFT JOIN public.controlled_drugs cd ON ((cdd.controlled_drug_id = cd.id)))
     LEFT JOIN public.profiles p ON ((cdd.patient_user_id = p.user_id)))
     LEFT JOIN public.profiles pres ON ((cdd.prescriber_user_id = pres.user_id)))
     LEFT JOIN public.prescriptions presc ON ((cdd.prescription_id = presc.id)))
     LEFT JOIN public.profiles pharm ON ((cdd.dispensing_pharmacist_id = pharm.user_id)))
     LEFT JOIN public.profiles witness ON ((cdd.witness_pharmacist_id = witness.user_id)))
  WITH NO DATA;


--
-- Name: data_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.data_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    accessed_table text NOT NULL,
    accessed_record_id uuid,
    access_type text NOT NULL,
    data_category text DEFAULT 'general'::text NOT NULL,
    patient_id uuid,
    reason text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT data_access_log_access_type_check CHECK ((access_type = ANY (ARRAY['view'::text, 'create'::text, 'update'::text, 'delete'::text, 'export'::text, 'print'::text]))),
    CONSTRAINT data_access_log_data_category_check CHECK ((data_category = ANY (ARRAY['general'::text, 'pii'::text, 'phi'::text, 'financial'::text, 'credentials'::text])))
);


--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.drug_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drug_a text NOT NULL,
    drug_b text NOT NULL,
    severity text NOT NULL,
    description text NOT NULL,
    recommendation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT drug_interactions_severity_check CHECK ((severity = ANY (ARRAY['mild'::text, 'moderate'::text, 'severe'::text, 'contraindicated'::text])))
);


--
-- Name: drug_recall_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.drug_recall_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recall_id uuid NOT NULL,
    pharmacy_id uuid,
    patient_user_id uuid,
    notification_type text NOT NULL,
    channels_used jsonb DEFAULT '[]'::jsonb NOT NULL,
    notified_at timestamp with time zone DEFAULT now() NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid
);


--
-- Name: drug_recalls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.drug_recalls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drug_name text NOT NULL,
    generic_name text,
    lot_numbers text[] DEFAULT '{}'::text[],
    manufacturer text,
    recall_reason text NOT NULL,
    recall_class text DEFAULT 'Class II'::text NOT NULL,
    affected_ndc_numbers text[] DEFAULT '{}'::text[],
    recall_date date DEFAULT CURRENT_DATE NOT NULL,
    expiry_date_range text,
    instructions text,
    fda_reference text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: drug_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.drug_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_pharmacy_id uuid NOT NULL,
    destination_pharmacy_id uuid NOT NULL,
    drug_name text NOT NULL,
    generic_name text,
    dosage text,
    form text,
    quantity integer NOT NULL,
    lot_number text,
    expiry_date date,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    completed_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    medication_catalog_id uuid
);


--
-- Name: medication_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.medication_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    generic_name text,
    dosage text NOT NULL,
    dosage_unit text DEFAULT 'mg'::text NOT NULL,
    form text DEFAULT 'tablet'::text NOT NULL,
    ndc_number text,
    manufacturer text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: drug_transfers_full; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.drug_transfers_full AS
 SELECT dt.id,
    dt.source_pharmacy_id,
    dt.destination_pharmacy_id,
    COALESCE(mc.name, dt.drug_name) AS drug_name,
    COALESCE(mc.generic_name, dt.generic_name) AS generic_name,
    COALESCE(mc.dosage, dt.dosage) AS dosage,
    COALESCE(mc.form, dt.form) AS form,
    dt.quantity,
    dt.lot_number,
    dt.expiry_date,
    dt.reason,
    dt.status,
    dt.requested_by,
    dt.approved_by,
    dt.completed_by,
    dt.requested_at,
    dt.approved_at,
    dt.completed_at,
    dt.notes,
    dt.created_at,
    dt.updated_at
   FROM (public.drug_transfers dt
     LEFT JOIN public.medication_catalog mc ON ((dt.medication_catalog_id = mc.id)));


--
-- Name: pharmacy_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.pharmacy_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pharmacist_user_id uuid NOT NULL,
    name text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state text NOT NULL,
    country text DEFAULT 'Nigeria'::text NOT NULL,
    phone text,
    email text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: drug_transfers_full_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.drug_transfers_full_view AS
 SELECT dt.id,
    dt.source_pharmacy_id,
    sp.name AS source_pharmacy_name,
    dt.destination_pharmacy_id,
    dp.name AS destination_pharmacy_name,
    mc.id AS medication_catalog_id,
    COALESCE(mc.name, dt.drug_name) AS drug_name,
    COALESCE(mc.generic_name, dt.generic_name) AS generic_name,
    COALESCE(mc.dosage, dt.dosage) AS dosage,
    COALESCE(mc.form, dt.form) AS form,
    dt.quantity,
    dt.lot_number,
    dt.expiry_date,
    dt.reason,
    dt.status,
    dt.requested_by,
    ((req.first_name || ' '::text) || COALESCE(req.last_name, ''::text)) AS requested_by_name,
    dt.approved_by,
    ((app.first_name || ' '::text) || COALESCE(app.last_name, ''::text)) AS approved_by_name,
    dt.completed_by,
    ((comp.first_name || ' '::text) || COALESCE(comp.last_name, ''::text)) AS completed_by_name,
    dt.requested_at,
    dt.approved_at,
    dt.completed_at,
    dt.notes,
    dt.created_at,
    dt.updated_at
   FROM ((((((public.drug_transfers dt
     LEFT JOIN public.medication_catalog mc ON ((dt.medication_catalog_id = mc.id)))
     LEFT JOIN public.pharmacy_locations sp ON ((dt.source_pharmacy_id = sp.id)))
     LEFT JOIN public.pharmacy_locations dp ON ((dt.destination_pharmacy_id = dp.id)))
     LEFT JOIN public.profiles req ON ((dt.requested_by = req.user_id)))
     LEFT JOIN public.profiles app ON ((dt.approved_by = app.user_id)))
     LEFT JOIN public.profiles comp ON ((dt.completed_by = comp.user_id)))
  WITH NO DATA;


--
-- Name: email_ab_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.email_ab_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    notification_id uuid NOT NULL,
    variant text NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_ab_assignments_variant_check CHECK ((variant = ANY (ARRAY['A'::text, 'B'::text])))
);


--
-- Name: email_ab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.email_ab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_name text NOT NULL,
    notification_type text NOT NULL,
    variant_a_subject text NOT NULL,
    variant_a_preview text,
    variant_b_subject text NOT NULL,
    variant_b_preview text,
    is_active boolean DEFAULT true NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: external_user_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.external_user_mapping (
    external_id text NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.lab_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ordered_by uuid,
    test_name text NOT NULL,
    test_code text,
    category text DEFAULT 'general'::text NOT NULL,
    result_value text NOT NULL,
    result_unit text,
    reference_range text,
    status text DEFAULT 'pending'::text NOT NULL,
    is_abnormal boolean DEFAULT false,
    abnormal_flag text,
    ordered_at timestamp with time zone DEFAULT now() NOT NULL,
    collected_at timestamp with time zone,
    resulted_at timestamp with time zone,
    lab_name text,
    notes text,
    attachment_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    ip_address text,
    user_agent text,
    success boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medication_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.medication_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pharmacy_id uuid NOT NULL,
    medication_name text NOT NULL,
    generic_name text,
    dosage text,
    form text,
    is_available boolean DEFAULT true NOT NULL,
    quantity_available integer,
    price_naira numeric(10,2),
    notes text,
    last_updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    medication_catalog_id uuid
);


--
-- Name: medication_availability_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.medication_availability_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    medication_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notify_email boolean DEFAULT true NOT NULL,
    notify_sms boolean DEFAULT true NOT NULL,
    notify_whatsapp boolean DEFAULT true NOT NULL,
    notify_push boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    medication_catalog_id uuid
);


--
-- Name: medication_availability_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.medication_availability_view AS
 SELECT ma.id,
    ma.pharmacy_id,
    pl.name AS pharmacy_name,
    pl.city AS pharmacy_city,
    pl.state AS pharmacy_state,
    mc.id AS medication_catalog_id,
    mc.name AS medication_name,
    mc.generic_name,
    mc.dosage,
    mc.dosage_unit,
    mc.form,
    ma.is_available,
    ma.quantity_available,
    ma.price_naira,
    ma.notes,
    ma.last_updated_by,
    ma.created_at,
    ma.updated_at
   FROM ((public.medication_availability ma
     LEFT JOIN public.medication_catalog mc ON ((ma.medication_catalog_id = mc.id)))
     LEFT JOIN public.pharmacy_locations pl ON ((ma.pharmacy_id = pl.id)))
  WHERE (ma.is_available = true)
  WITH NO DATA;


--
-- Name: medication_availability_with_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.medication_availability_with_details AS
 SELECT ma.id,
    ma.pharmacy_id,
    COALESCE(mc.name, ma.medication_name) AS medication_name,
    COALESCE(mc.generic_name, ma.generic_name) AS generic_name,
    COALESCE(mc.dosage, ma.dosage) AS dosage,
    COALESCE(mc.form, ma.form) AS form,
    ma.is_available,
    ma.quantity_available,
    ma.price_naira,
    ma.notes,
    ma.last_updated_by,
    ma.created_at,
    ma.updated_at
   FROM (public.medication_availability ma
     LEFT JOIN public.medication_catalog mc ON ((ma.medication_catalog_id = mc.id)));


--
-- Name: medication_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.medication_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    schedule_id uuid NOT NULL,
    medication_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scheduled_time timestamp with time zone NOT NULL,
    taken_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: medication_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.medication_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    medication_id uuid NOT NULL,
    time_of_day time without time zone NOT NULL,
    days_of_week integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    with_food boolean DEFAULT false,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);


--
-- Name: medications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.medications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    dosage text NOT NULL,
    dosage_unit text DEFAULT 'mg'::text NOT NULL,
    form text DEFAULT 'tablet'::text NOT NULL,
    instructions text,
    prescriber text,
    pharmacy text,
    refills_remaining integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    prescription_status text DEFAULT 'pending'::text NOT NULL,
    prescriber_user_id uuid,
    pharmacy_id uuid,
    medication_catalog_id uuid,
    CONSTRAINT valid_prescription_status CHECK ((prescription_status = ANY (ARRAY['pending'::text, 'sent'::text, 'ready'::text, 'picked_up'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: medication_schedules_with_user; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.medication_schedules_with_user AS
 SELECT ms.id,
    ms.medication_id,
    m.user_id,
    ms.time_of_day,
    ms.days_of_week,
    ms.quantity,
    ms.with_food,
    ms.is_active,
    ms.created_at
   FROM (public.medication_schedules ms
     JOIN public.medications m ON ((ms.medication_id = m.id)));


--
-- Name: medications_full_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.medications_full_view AS
 SELECT m.id,
    m.user_id,
    ((p.first_name || ' '::text) || COALESCE(p.last_name, ''::text)) AS patient_name,
    m.name,
    m.dosage,
    m.dosage_unit,
    m.form,
    m.instructions,
    m.prescriber_user_id,
    ((pres.first_name || ' '::text) || COALESCE(pres.last_name, ''::text)) AS prescriber_name,
    m.pharmacy_id,
    pl.name AS pharmacy_name,
    pl.city AS pharmacy_city,
    pl.state AS pharmacy_state,
    m.refills_remaining,
    m.is_active,
    m.start_date,
    m.end_date,
    m.created_at,
    m.updated_at
   FROM (((public.medications m
     LEFT JOIN public.profiles p ON ((m.user_id = p.user_id)))
     LEFT JOIN public.profiles pres ON ((m.prescriber_user_id = pres.user_id)))
     LEFT JOIN public.pharmacy_locations pl ON ((m.pharmacy_id = pl.id)))
  WITH NO DATA;


--
-- Name: medications_with_details; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.medications_with_details AS
 SELECT m.id,
    m.user_id,
    m.name,
    m.dosage,
    m.dosage_unit,
    m.form,
    m.instructions,
    m.prescriber_user_id,
    concat(p.first_name, ' ', COALESCE(p.last_name, ''::text)) AS prescriber,
    m.pharmacy_id,
    pl.name AS pharmacy,
    m.refills_remaining,
    m.is_active,
    m.start_date,
    m.end_date,
    m.created_at,
    m.updated_at
   FROM ((public.medications m
     LEFT JOIN public.profiles p ON ((m.prescriber_user_id = p.user_id)))
     LEFT JOIN public.pharmacy_locations pl ON ((m.pharmacy_id = pl.id)));


--
-- Name: mfa_recovery_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code_hash text NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.notification_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    channel text NOT NULL,
    notification_type text NOT NULL,
    title text NOT NULL,
    body text,
    status text DEFAULT 'sent'::text NOT NULL,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    next_retry_at timestamp with time zone,
    last_retry_at timestamp with time zone,
    delivered_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    CONSTRAINT notification_history_channel_check CHECK ((channel = ANY (ARRAY['push'::text, 'email'::text, 'in_app'::text, 'whatsapp'::text]))),
    CONSTRAINT notification_history_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'failed'::text, 'pending'::text])))
);


--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: organization_branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.organization_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    app_name text DEFAULT 'Pillaxia'::text NOT NULL,
    logo_url text,
    logo_dark_url text,
    favicon_url text,
    primary_color text DEFAULT '244 69% 31%'::text,
    secondary_color text DEFAULT '280 100% 70%'::text,
    accent_color text DEFAULT '174 72% 40%'::text,
    font_family text DEFAULT 'Inter, sans-serif'::text,
    border_radius text DEFAULT '0.5rem'::text,
    support_email text,
    support_phone text,
    terms_url text,
    privacy_url text,
    email_header_color text,
    email_footer_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.organization_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_invoice_id text,
    amount_due integer NOT NULL,
    amount_paid integer DEFAULT 0,
    currency text DEFAULT 'usd'::text,
    status text DEFAULT 'draft'::text NOT NULL,
    invoice_pdf text,
    hosted_invoice_url text,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    due_date timestamp with time zone,
    paid_at timestamp with time zone,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.organization_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_product_id text,
    stripe_price_id text,
    status public.subscription_status DEFAULT 'incomplete'::public.subscription_status NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    seats_purchased integer DEFAULT 1,
    seats_used integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_invoices_full; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.organization_invoices_full AS
 SELECT oi.id,
    oi.organization_id,
    oi.stripe_invoice_id,
    os.stripe_customer_id,
    oi.amount_due,
    oi.amount_paid,
    oi.currency,
    oi.status,
    oi.invoice_pdf,
    oi.hosted_invoice_url,
    oi.period_start,
    oi.period_end,
    oi.due_date,
    oi.paid_at,
    oi.description,
    oi.created_at,
    oi.updated_at
   FROM (public.organization_invoices oi
     LEFT JOIN public.organization_subscriptions os ON ((oi.organization_id = os.organization_id)));


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    status public.organization_status DEFAULT 'trial'::public.organization_status NOT NULL,
    license_type text DEFAULT 'standard'::text,
    max_users integer DEFAULT 50,
    contact_email text,
    contact_phone text,
    address text,
    city text,
    state text,
    country text DEFAULT 'Nigeria'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_invoices_full_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.organization_invoices_full_view AS
 SELECT oi.id,
    oi.organization_id,
    o.name AS organization_name,
    oi.stripe_invoice_id,
    os.stripe_customer_id,
    oi.amount_due,
    oi.amount_paid,
    oi.currency,
    oi.status,
    oi.invoice_pdf,
    oi.hosted_invoice_url,
    oi.period_start,
    oi.period_end,
    oi.due_date,
    oi.paid_at,
    oi.description,
    oi.created_at,
    oi.updated_at
   FROM ((public.organization_invoices oi
     LEFT JOIN public.organizations o ON ((oi.organization_id = o.id)))
     LEFT JOIN public.organization_subscriptions os ON ((oi.organization_id = os.organization_id)))
  WITH NO DATA;


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_role public.organization_role DEFAULT 'member'::public.organization_role NOT NULL,
    invited_by uuid,
    invited_at timestamp with time zone,
    joined_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.organization_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    stripe_payment_method_id text,
    type text DEFAULT 'card'::text NOT NULL,
    card_brand text,
    card_last4 text,
    card_exp_month integer,
    card_exp_year integer,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    activity_type text NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_allergies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_allergies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    allergen text NOT NULL,
    reaction_type text,
    reaction_description text,
    is_drug_allergy boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_chronic_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_chronic_conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    condition_name text NOT NULL,
    diagnosed_date date,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_emergency_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_emergency_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    relationship text NOT NULL,
    phone text NOT NULL,
    email text,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_engagement_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_engagement_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    score_date date DEFAULT CURRENT_DATE NOT NULL,
    adherence_score numeric(5,2) DEFAULT 0 NOT NULL,
    app_usage_score numeric(5,2) DEFAULT 0 NOT NULL,
    notification_score numeric(5,2) DEFAULT 0 NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    overall_score numeric(5,2) GENERATED ALWAYS AS (round((((adherence_score + app_usage_score) + notification_score) / 3.0), 2)) STORED,
    risk_level text GENERATED ALWAYS AS (
CASE
    WHEN (round((((adherence_score + app_usage_score) + notification_score) / 3.0), 2) >= (70)::numeric) THEN 'low'::text
    WHEN (round((((adherence_score + app_usage_score) + notification_score) / 3.0), 2) >= (40)::numeric) THEN 'medium'::text
    ELSE 'high'::text
END) STORED
);


--
-- Name: patient_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_reminders boolean DEFAULT true NOT NULL,
    in_app_reminders boolean DEFAULT true NOT NULL,
    email_missed_alerts boolean DEFAULT true NOT NULL,
    in_app_missed_alerts boolean DEFAULT true NOT NULL,
    email_encouragements boolean DEFAULT true NOT NULL,
    in_app_encouragements boolean DEFAULT true NOT NULL,
    quiet_hours_enabled boolean DEFAULT false NOT NULL,
    quiet_hours_start time without time zone DEFAULT '22:00:00'::time without time zone,
    quiet_hours_end time without time zone DEFAULT '07:00:00'::time without time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_clinician_messages boolean DEFAULT true NOT NULL,
    push_clinician_messages boolean DEFAULT true NOT NULL,
    whatsapp_clinician_messages boolean DEFAULT true NOT NULL,
    sms_reminders boolean DEFAULT true NOT NULL,
    sms_clinician_messages boolean DEFAULT true NOT NULL
);


--
-- Name: patient_preferred_pharmacies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_preferred_pharmacies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    pharmacy_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_risk_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_risk_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    clinician_user_id uuid NOT NULL,
    flag_type text NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    description text,
    metric_value numeric,
    days_since_last_log integer,
    is_resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT patient_risk_flags_flag_type_check CHECK ((flag_type = ANY (ARRAY['no_logging'::text, 'low_adherence'::text]))),
    CONSTRAINT patient_risk_flags_severity_check CHECK ((severity = ANY (ARRAY['warning'::text, 'critical'::text])))
);


--
-- Name: patient_vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.patient_vitals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    recorded_by uuid,
    blood_pressure_systolic integer,
    blood_pressure_diastolic integer,
    heart_rate integer,
    temperature numeric(4,1),
    respiratory_rate integer,
    oxygen_saturation integer,
    weight numeric(5,2),
    height numeric(5,2),
    blood_glucose numeric(5,1),
    notes text,
    is_fasting boolean DEFAULT false,
    measurement_location text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patient_vitals_with_bmi; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.patient_vitals_with_bmi AS
 SELECT patient_vitals.id,
    patient_vitals.user_id,
    patient_vitals.recorded_at,
    patient_vitals.recorded_by,
    patient_vitals.blood_pressure_systolic,
    patient_vitals.blood_pressure_diastolic,
    patient_vitals.heart_rate,
    patient_vitals.temperature,
    patient_vitals.respiratory_rate,
    patient_vitals.oxygen_saturation,
    patient_vitals.weight,
    patient_vitals.height,
        CASE
            WHEN ((patient_vitals.height > (0)::numeric) AND (patient_vitals.weight > (0)::numeric)) THEN round((patient_vitals.weight / power((patient_vitals.height / 100.0), (2)::numeric)), 1)
            ELSE NULL::numeric
        END AS bmi,
    patient_vitals.blood_glucose,
    patient_vitals.notes,
    patient_vitals.is_fasting,
    patient_vitals.measurement_location,
    patient_vitals.created_at,
    patient_vitals.updated_at
   FROM public.patient_vitals;


--
-- Name: patient_vitals_with_bmi_view; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.patient_vitals_with_bmi_view AS
 SELECT pv.id,
    pv.user_id,
    ((p.first_name || ' '::text) || COALESCE(p.last_name, ''::text)) AS patient_name,
    pv.recorded_at,
    pv.recorded_by,
    ((pr.first_name || ' '::text) || COALESCE(pr.last_name, ''::text)) AS recorded_by_name,
    pv.blood_pressure_systolic,
    pv.blood_pressure_diastolic,
    pv.heart_rate,
    pv.temperature,
    pv.respiratory_rate,
    pv.oxygen_saturation,
    pv.weight,
    pv.height,
        CASE
            WHEN ((pv.height > (0)::numeric) AND (pv.weight > (0)::numeric)) THEN round((pv.weight / power((pv.height / 100.0), (2)::numeric)), 1)
            ELSE NULL::numeric
        END AS bmi,
    pv.blood_glucose,
    pv.notes,
    pv.is_fasting,
    pv.measurement_location,
    pv.created_at,
    pv.updated_at
   FROM ((public.patient_vitals pv
     LEFT JOIN public.profiles p ON ((pv.user_id = p.user_id)))
     LEFT JOIN public.profiles pr ON ((pv.recorded_by = pr.user_id)))
  WITH NO DATA;


--
-- Name: polypharmacy_warnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.polypharmacy_warnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    medication_count integer NOT NULL,
    is_acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: post_call_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.post_call_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    clinician_user_id uuid NOT NULL,
    summary text NOT NULL,
    recommendations text,
    follow_up_date date,
    prescriptions_written jsonb DEFAULT '[]'::jsonb,
    sent_to_patient boolean DEFAULT false NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prescription_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.prescription_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    changed_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    email text,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles_with_email; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profiles_with_email AS
 SELECT p.id,
    p.user_id,
    p.first_name,
    p.last_name,
    u.email,
    p.phone,
    p.organization_id,
    o.name AS organization,
    p.language_preference,
    p.avatar_url,
    p.created_at,
    p.updated_at
   FROM ((public.profiles p
     LEFT JOIN public.users u ON ((p.user_id = u.id)))
     LEFT JOIN public.organizations o ON ((p.organization_id = o.id)));


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    native_token text,
    platform text DEFAULT 'web'::text
);


--
-- Name: red_flag_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.red_flag_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    clinician_user_id uuid NOT NULL,
    symptom_entry_id uuid,
    alert_type text DEFAULT 'severe_symptom'::text NOT NULL,
    severity integer NOT NULL,
    symptom_type text NOT NULL,
    description text,
    is_acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refill_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.refill_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_user_id uuid NOT NULL,
    medication_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    patient_notes text,
    pharmacist_notes text,
    refills_granted integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations_old; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.schema_migrations_old (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type public.security_event_type NOT NULL,
    event_category text DEFAULT 'authentication'::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    description text,
    ip_address text,
    user_agent text,
    device_fingerprint text,
    location jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT security_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])))
);


--
-- Name: security_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.security_notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notify_account_locked boolean DEFAULT true NOT NULL,
    notify_account_unlocked boolean DEFAULT true NOT NULL,
    notify_password_change boolean DEFAULT true NOT NULL,
    notify_password_reset boolean DEFAULT true NOT NULL,
    notify_suspicious_activity boolean DEFAULT true NOT NULL,
    notify_new_device_login boolean DEFAULT true NOT NULL,
    notify_concurrent_session_blocked boolean DEFAULT true NOT NULL,
    notify_mfa_enabled boolean DEFAULT true NOT NULL,
    notify_mfa_disabled boolean DEFAULT true NOT NULL,
    notify_data_export boolean DEFAULT true NOT NULL,
    notify_permission_change boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.security_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: soap_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.soap_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    subjective text,
    objective text,
    assessment text,
    plan text,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: symptom_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.symptom_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    symptom_type text NOT NULL,
    severity integer NOT NULL,
    description text,
    medication_id uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT symptom_entries_severity_check CHECK (((severity >= 1) AND (severity <= 10)))
);


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.trusted_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_token_hash text NOT NULL,
    device_name text,
    browser text,
    operating_system text,
    ip_address text,
    trusted_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_login_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.user_login_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ip_address text NOT NULL,
    city text DEFAULT 'Unknown'::text NOT NULL,
    region text DEFAULT 'Unknown'::text,
    country text DEFAULT 'Unknown'::text NOT NULL,
    country_code text DEFAULT 'XX'::text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    timezone text,
    isp text,
    user_agent text,
    is_trusted boolean DEFAULT false NOT NULL,
    action text DEFAULT 'login'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    device_info jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    location jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone
);


--
-- Name: video_call_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.video_call_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    subjective text,
    objective text,
    assessment text,
    plan text,
    is_draft boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: video_room_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.video_room_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    user_id uuid NOT NULL,
    participant_type text DEFAULT 'patient'::text NOT NULL,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    is_in_waiting_room boolean DEFAULT true NOT NULL,
    admitted_at timestamp with time zone,
    admitted_by uuid,
    connection_quality text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: video_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.video_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_name text NOT NULL,
    room_sid text,
    appointment_id uuid,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    is_group_call boolean DEFAULT false NOT NULL,
    recording_enabled boolean DEFAULT false NOT NULL,
    recording_sid text,
    recording_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vitals_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.vitals_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    vital_id uuid,
    alert_type text NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    message text NOT NULL,
    is_acknowledged boolean DEFAULT false,
    acknowledged_by uuid,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: waiting_room_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.waiting_room_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinician_user_id uuid NOT NULL,
    patient_user_id uuid NOT NULL,
    room_id uuid,
    queue_position integer DEFAULT 0 NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    reason_for_visit text,
    entered_at timestamp with time zone DEFAULT now() NOT NULL,
    called_at timestamp with time zone,
    status text DEFAULT 'waiting'::text NOT NULL,
    estimated_wait_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_lockouts account_lockouts_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_lockouts
    ADD CONSTRAINT account_lockouts_email_key UNIQUE (email);


--
-- Name: account_lockouts account_lockouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_lockouts
    ADD CONSTRAINT account_lockouts_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: availability_notification_history availability_notification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_notification_history
    ADD CONSTRAINT availability_notification_history_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);


--
-- Name: billing_events billing_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: caregiver_invitations caregiver_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_invitations
    ADD CONSTRAINT caregiver_invitations_pkey PRIMARY KEY (id);


--
-- Name: caregiver_messages caregiver_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_messages
    ADD CONSTRAINT caregiver_messages_pkey PRIMARY KEY (id);


--
-- Name: clinician_messages clinician_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_messages
    ADD CONSTRAINT clinician_messages_pkey PRIMARY KEY (id);


--
-- Name: clinician_patient_assignments clinician_patient_assignments_clinician_user_id_patient_use_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_patient_assignments
    ADD CONSTRAINT clinician_patient_assignments_clinician_user_id_patient_use_key UNIQUE (clinician_user_id, patient_user_id);


--
-- Name: clinician_patient_assignments clinician_patient_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_patient_assignments
    ADD CONSTRAINT clinician_patient_assignments_pkey PRIMARY KEY (id);


--
-- Name: compliance_reports compliance_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_reports
    ADD CONSTRAINT compliance_reports_pkey PRIMARY KEY (id);


--
-- Name: controlled_drug_adjustments controlled_drug_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_adjustments
    ADD CONSTRAINT controlled_drug_adjustments_pkey PRIMARY KEY (id);


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_pkey PRIMARY KEY (id);


--
-- Name: controlled_drugs controlled_drugs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drugs
    ADD CONSTRAINT controlled_drugs_pkey PRIMARY KEY (id);


--
-- Name: data_access_log data_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_log
    ADD CONSTRAINT data_access_log_pkey PRIMARY KEY (id);


--
-- Name: drug_interactions drug_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT drug_interactions_pkey PRIMARY KEY (id);


--
-- Name: drug_recall_notifications drug_recall_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_recall_notifications
    ADD CONSTRAINT drug_recall_notifications_pkey PRIMARY KEY (id);


--
-- Name: drug_recalls drug_recalls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_recalls
    ADD CONSTRAINT drug_recalls_pkey PRIMARY KEY (id);


--
-- Name: drug_transfers drug_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_transfers
    ADD CONSTRAINT drug_transfers_pkey PRIMARY KEY (id);


--
-- Name: email_ab_assignments email_ab_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ab_assignments
    ADD CONSTRAINT email_ab_assignments_pkey PRIMARY KEY (id);


--
-- Name: email_ab_tests email_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ab_tests
    ADD CONSTRAINT email_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: external_user_mapping external_user_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user_mapping
    ADD CONSTRAINT external_user_mapping_pkey PRIMARY KEY (external_id);


--
-- Name: external_user_mapping external_user_mapping_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user_mapping
    ADD CONSTRAINT external_user_mapping_user_id_key UNIQUE (user_id);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (id);


--
-- Name: medication_availability_alerts medication_availability_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability_alerts
    ADD CONSTRAINT medication_availability_alerts_pkey PRIMARY KEY (id);


--
-- Name: medication_availability medication_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability
    ADD CONSTRAINT medication_availability_pkey PRIMARY KEY (id);


--
-- Name: medication_catalog medication_catalog_name_dosage_dosage_unit_form_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_catalog
    ADD CONSTRAINT medication_catalog_name_dosage_dosage_unit_form_key UNIQUE (name, dosage, dosage_unit, form);


--
-- Name: medication_catalog medication_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_catalog
    ADD CONSTRAINT medication_catalog_pkey PRIMARY KEY (id);


--
-- Name: medication_logs medication_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_logs
    ADD CONSTRAINT medication_logs_pkey PRIMARY KEY (id);


--
-- Name: medication_schedules medication_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_schedules
    ADD CONSTRAINT medication_schedules_pkey PRIMARY KEY (id);


--
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--
-- Name: notification_history notification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_history
    ADD CONSTRAINT notification_history_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: organization_branding organization_branding_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_branding
    ADD CONSTRAINT organization_branding_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_branding organization_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_branding
    ADD CONSTRAINT organization_branding_pkey PRIMARY KEY (id);


--
-- Name: organization_invoices organization_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invoices
    ADD CONSTRAINT organization_invoices_pkey PRIMARY KEY (id);


--
-- Name: organization_invoices organization_invoices_stripe_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invoices
    ADD CONSTRAINT organization_invoices_stripe_invoice_id_key UNIQUE (stripe_invoice_id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organization_payment_methods organization_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_payment_methods
    ADD CONSTRAINT organization_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: organization_payment_methods organization_payment_methods_stripe_payment_method_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_payment_methods
    ADD CONSTRAINT organization_payment_methods_stripe_payment_method_id_key UNIQUE (stripe_payment_method_id);


--
-- Name: organization_subscriptions organization_subscriptions_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_subscriptions organization_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: organization_subscriptions organization_subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: patient_activity_log patient_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_activity_log
    ADD CONSTRAINT patient_activity_log_pkey PRIMARY KEY (id);


--
-- Name: patient_allergies patient_allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT patient_allergies_pkey PRIMARY KEY (id);


--
-- Name: patient_chronic_conditions patient_chronic_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_chronic_conditions
    ADD CONSTRAINT patient_chronic_conditions_pkey PRIMARY KEY (id);


--
-- Name: patient_emergency_contacts patient_emergency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_emergency_contacts
    ADD CONSTRAINT patient_emergency_contacts_pkey PRIMARY KEY (id);


--
-- Name: patient_engagement_scores patient_engagement_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_engagement_scores
    ADD CONSTRAINT patient_engagement_scores_pkey PRIMARY KEY (id);


--
-- Name: patient_engagement_scores patient_engagement_scores_user_id_score_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_engagement_scores
    ADD CONSTRAINT patient_engagement_scores_user_id_score_date_key UNIQUE (user_id, score_date);


--
-- Name: patient_notification_preferences patient_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notification_preferences
    ADD CONSTRAINT patient_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: patient_notification_preferences patient_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notification_preferences
    ADD CONSTRAINT patient_notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: patient_preferred_pharmacies patient_preferred_pharmacies_patient_user_id_pharmacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_preferred_pharmacies
    ADD CONSTRAINT patient_preferred_pharmacies_patient_user_id_pharmacy_id_key UNIQUE (patient_user_id, pharmacy_id);


--
-- Name: patient_preferred_pharmacies patient_preferred_pharmacies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_preferred_pharmacies
    ADD CONSTRAINT patient_preferred_pharmacies_pkey PRIMARY KEY (id);


--
-- Name: patient_risk_flags patient_risk_flags_patient_user_id_clinician_user_id_flag_t_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_risk_flags
    ADD CONSTRAINT patient_risk_flags_patient_user_id_clinician_user_id_flag_t_key UNIQUE (patient_user_id, clinician_user_id, flag_type, is_resolved);


--
-- Name: patient_risk_flags patient_risk_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_risk_flags
    ADD CONSTRAINT patient_risk_flags_pkey PRIMARY KEY (id);


--
-- Name: patient_vitals patient_vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vitals
    ADD CONSTRAINT patient_vitals_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_locations pharmacy_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_locations
    ADD CONSTRAINT pharmacy_locations_pkey PRIMARY KEY (id);


--
-- Name: polypharmacy_warnings polypharmacy_warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.polypharmacy_warnings
    ADD CONSTRAINT polypharmacy_warnings_pkey PRIMARY KEY (id);


--
-- Name: post_call_summaries post_call_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_call_summaries
    ADD CONSTRAINT post_call_summaries_pkey PRIMARY KEY (id);


--
-- Name: prescription_status_history prescription_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_status_history
    ADD CONSTRAINT prescription_status_history_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_prescription_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_prescription_number_key UNIQUE (prescription_number);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_user_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);


--
-- Name: red_flag_alerts red_flag_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.red_flag_alerts
    ADD CONSTRAINT red_flag_alerts_pkey PRIMARY KEY (id);


--
-- Name: refill_requests refill_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations_old schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations_old
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: schema_migrations schema_migrations_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey1 PRIMARY KEY (filename);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: security_notification_preferences security_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_notification_preferences
    ADD CONSTRAINT security_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: security_notification_preferences security_notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_notification_preferences
    ADD CONSTRAINT security_notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: security_settings security_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_pkey PRIMARY KEY (id);


--
-- Name: security_settings security_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: soap_notes soap_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_pkey PRIMARY KEY (id);


--
-- Name: symptom_entries symptom_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.symptom_entries
    ADD CONSTRAINT symptom_entries_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: medication_availability uq_medication_availability_pharmacy_catalog; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability
    ADD CONSTRAINT uq_medication_availability_pharmacy_catalog UNIQUE (pharmacy_id, medication_catalog_id);


--
-- Name: user_login_locations user_login_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_login_locations
    ADD CONSTRAINT user_login_locations_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_key UNIQUE (session_token);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: video_call_notes video_call_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_call_notes
    ADD CONSTRAINT video_call_notes_pkey PRIMARY KEY (id);


--
-- Name: video_room_participants video_room_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_room_participants
    ADD CONSTRAINT video_room_participants_pkey PRIMARY KEY (id);


--
-- Name: video_rooms video_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_rooms
    ADD CONSTRAINT video_rooms_pkey PRIMARY KEY (id);


--
-- Name: video_rooms video_rooms_room_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_rooms
    ADD CONSTRAINT video_rooms_room_name_key UNIQUE (room_name);


--
-- Name: vitals_alerts vitals_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals_alerts
    ADD CONSTRAINT vitals_alerts_pkey PRIMARY KEY (id);


--
-- Name: waiting_room_queue waiting_room_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_room_queue
    ADD CONSTRAINT waiting_room_queue_pkey PRIMARY KEY (id);


--
-- Name: idx_account_lockouts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_account_lockouts_active ON public.account_lockouts USING btree (email, locked_until) WHERE (unlocked_at IS NULL);


--
-- Name: idx_account_lockouts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_account_lockouts_email ON public.account_lockouts USING btree (email);


--
-- Name: idx_account_lockouts_email_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_account_lockouts_email_active ON public.account_lockouts USING btree (email) WHERE (unlocked_at IS NULL);


--
-- Name: idx_account_lockouts_locked_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until ON public.account_lockouts USING btree (locked_until);


--
-- Name: idx_activity_log_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_activity_log_type ON public.patient_activity_log USING btree (activity_type, created_at DESC);


--
-- Name: idx_activity_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.patient_activity_log USING btree (user_id, created_at DESC);


--
-- Name: idx_appointments_clinician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_appointments_clinician ON public.appointments USING btree (clinician_user_id);


--
-- Name: idx_appointments_clinician_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_appointments_clinician_date ON public.appointments USING btree (clinician_user_id, appointment_date DESC);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- Name: idx_appointments_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments USING btree (patient_user_id);


--
-- Name: idx_appointments_patient_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_appointments_patient_date ON public.appointments USING btree (patient_user_id, appointment_date DESC);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_audit_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log USING btree (action);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log USING btree (created_at);


--
-- Name: idx_audit_log_details; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_details ON public.audit_log USING gin (details);


--
-- Name: idx_audit_log_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON public.audit_log USING btree (user_id, created_at DESC);


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log USING btree (user_id);


--
-- Name: idx_billing_events_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_billing_events_org_id ON public.billing_events USING btree (organization_id);


--
-- Name: idx_billing_events_org_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_billing_events_org_type ON public.billing_events USING btree (organization_id, event_type, created_at DESC);


--
-- Name: idx_caregiver_invitations_caregiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_caregiver ON public.caregiver_invitations USING btree (caregiver_user_id);


--
-- Name: idx_caregiver_invitations_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_patient ON public.caregiver_invitations USING btree (patient_user_id);


--
-- Name: idx_caregiver_invitations_patient_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_patient_status ON public.caregiver_invitations USING btree (patient_user_id, status);


--
-- Name: idx_caregiver_invitations_permissions_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_permissions_gin ON public.caregiver_invitations USING gin (permissions);


--
-- Name: idx_caregiver_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_caregiver_messages_conversation ON public.caregiver_messages USING btree (patient_user_id, caregiver_user_id, created_at DESC);


--
-- Name: idx_clinician_assignments_clinician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_assignments_clinician ON public.clinician_patient_assignments USING btree (clinician_user_id);


--
-- Name: idx_clinician_assignments_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_assignments_patient ON public.clinician_patient_assignments USING btree (patient_user_id);


--
-- Name: idx_clinician_messages_clinician_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_messages_clinician_created ON public.clinician_messages USING btree (clinician_user_id, created_at DESC);


--
-- Name: idx_clinician_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_messages_conversation ON public.clinician_messages USING btree (patient_user_id, clinician_user_id, created_at DESC);


--
-- Name: idx_clinician_messages_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_messages_delivery_status ON public.clinician_messages USING gin (delivery_status);


--
-- Name: idx_clinician_messages_patient_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_messages_patient_created ON public.clinician_messages USING btree (patient_user_id, created_at DESC);


--
-- Name: idx_clinician_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_messages_unread ON public.clinician_messages USING btree (patient_user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_clinician_patient_clinician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_patient_clinician ON public.clinician_patient_assignments USING btree (clinician_user_id);


--
-- Name: idx_clinician_patient_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_clinician_patient_patient ON public.clinician_patient_assignments USING btree (patient_user_id);


--
-- Name: idx_controlled_drug_dispensing_dispensed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_dispensed_at ON public.controlled_drug_dispensing USING btree (dispensed_at DESC);


--
-- Name: idx_controlled_drug_dispensing_full_view_dispensed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_full_view_dispensed_at ON public.controlled_drug_dispensing_full_view USING btree (dispensed_at DESC);


--
-- Name: idx_controlled_drug_dispensing_full_view_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_full_view_id ON public.controlled_drug_dispensing_full_view USING btree (id);


--
-- Name: idx_controlled_drug_dispensing_full_view_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_full_view_patient ON public.controlled_drug_dispensing_full_view USING btree (patient_user_id);


--
-- Name: idx_controlled_drug_dispensing_full_view_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_full_view_schedule ON public.controlled_drug_dispensing_full_view USING btree (controlled_drug_schedule);


--
-- Name: idx_controlled_drug_dispensing_patient_prescriber; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_patient_prescriber ON public.controlled_drug_dispensing USING btree (patient_user_id, prescriber_user_id);


--
-- Name: idx_controlled_drug_dispensing_patient_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_patient_user_id ON public.controlled_drug_dispensing USING btree (patient_user_id);


--
-- Name: idx_controlled_drug_dispensing_prescriber_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_prescriber_user_id ON public.controlled_drug_dispensing USING btree (prescriber_user_id);


--
-- Name: idx_controlled_drug_dispensing_prescription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_prescription_id ON public.controlled_drug_dispensing USING btree (prescription_id);


--
-- Name: idx_controlled_drugs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drugs_active ON public.controlled_drugs USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_controlled_drugs_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drugs_expiry ON public.controlled_drugs USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: idx_controlled_drugs_low_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drugs_low_stock ON public.controlled_drugs USING btree (current_stock, minimum_stock) WHERE ((is_active = true) AND (current_stock <= minimum_stock));


--
-- Name: idx_controlled_drugs_stock_alert; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_controlled_drugs_stock_alert ON public.controlled_drugs USING btree (current_stock, minimum_stock) WHERE (is_active = true);


--
-- Name: idx_cpa_clinician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cpa_clinician ON public.clinician_patient_assignments USING btree (clinician_user_id);


--
-- Name: idx_cpa_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_cpa_patient ON public.clinician_patient_assignments USING btree (patient_user_id);


--
-- Name: idx_data_access_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_created_at ON public.data_access_log USING btree (created_at);


--
-- Name: idx_data_access_log_data_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_data_category ON public.data_access_log USING btree (data_category);


--
-- Name: idx_data_access_log_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_patient ON public.data_access_log USING btree (patient_id, created_at DESC) WHERE (patient_id IS NOT NULL);


--
-- Name: idx_data_access_log_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_patient_id ON public.data_access_log USING btree (patient_id);


--
-- Name: idx_data_access_log_patient_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_patient_time ON public.data_access_log USING btree (patient_id, created_at DESC) WHERE (patient_id IS NOT NULL);


--
-- Name: idx_data_access_log_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_user_created ON public.data_access_log USING btree (user_id, created_at DESC);


--
-- Name: idx_data_access_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_user_id ON public.data_access_log USING btree (user_id);


--
-- Name: idx_data_access_log_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_data_access_log_user_time ON public.data_access_log USING btree (user_id, created_at DESC);


--
-- Name: idx_drug_recalls_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_recalls_active ON public.drug_recalls USING btree (is_active, recall_date DESC) WHERE (is_active = true);


--
-- Name: idx_drug_transfers_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_catalog_id ON public.drug_transfers USING btree (medication_catalog_id);


--
-- Name: idx_drug_transfers_destination_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_destination_status ON public.drug_transfers USING btree (destination_pharmacy_id, status);


--
-- Name: idx_drug_transfers_full_view_destination; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_full_view_destination ON public.drug_transfers_full_view USING btree (destination_pharmacy_id);


--
-- Name: idx_drug_transfers_full_view_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_drug_transfers_full_view_id ON public.drug_transfers_full_view USING btree (id);


--
-- Name: idx_drug_transfers_full_view_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_full_view_source ON public.drug_transfers_full_view USING btree (source_pharmacy_id);


--
-- Name: idx_drug_transfers_full_view_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_full_view_status ON public.drug_transfers_full_view USING btree (status);


--
-- Name: idx_drug_transfers_source_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_source_status ON public.drug_transfers USING btree (source_pharmacy_id, status);


--
-- Name: idx_drug_transfers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_drug_transfers_status ON public.drug_transfers USING btree (status, requested_at DESC);


--
-- Name: idx_email_ab_assignments_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_email_ab_assignments_notification_id ON public.email_ab_assignments USING btree (notification_id);


--
-- Name: idx_email_ab_assignments_test_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_email_ab_assignments_test_id ON public.email_ab_assignments USING btree (test_id);


--
-- Name: idx_email_ab_tests_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_email_ab_tests_active ON public.email_ab_tests USING btree (is_active);


--
-- Name: idx_email_ab_tests_notification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_email_ab_tests_notification_type ON public.email_ab_tests USING btree (notification_type);


--
-- Name: idx_engagement_scores_metrics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_engagement_scores_metrics ON public.patient_engagement_scores USING gin (metrics);


--
-- Name: idx_engagement_scores_risk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_engagement_scores_risk ON public.patient_engagement_scores USING btree (risk_level, score_date DESC);


--
-- Name: idx_engagement_scores_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_engagement_scores_user_date ON public.patient_engagement_scores USING btree (user_id, score_date DESC);


--
-- Name: idx_external_user_mapping_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_external_user_mapping_user_id ON public.external_user_mapping USING btree (user_id);


--
-- Name: idx_lab_results_abnormal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_lab_results_abnormal ON public.lab_results USING btree (user_id, resulted_at DESC) WHERE (is_abnormal = true);


--
-- Name: idx_lab_results_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_lab_results_status ON public.lab_results USING btree (status);


--
-- Name: idx_lab_results_user_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_lab_results_user_category ON public.lab_results USING btree (user_id, category, ordered_at DESC);


--
-- Name: idx_lab_results_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_lab_results_user_id ON public.lab_results USING btree (user_id);


--
-- Name: idx_lab_results_user_ordered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_lab_results_user_ordered ON public.lab_results USING btree (user_id, ordered_at DESC);


--
-- Name: idx_login_attempts_email_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created ON public.login_attempts USING btree (email, created_at DESC);


--
-- Name: idx_login_attempts_email_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON public.login_attempts USING btree (email, created_at DESC);


--
-- Name: idx_login_attempts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON public.login_attempts USING btree (user_id);


--
-- Name: idx_med_avail_alerts_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_med_avail_alerts_catalog_id ON public.medication_availability_alerts USING btree (medication_catalog_id);


--
-- Name: idx_medication_alerts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_alerts_name ON public.medication_availability_alerts USING btree (medication_name);


--
-- Name: idx_medication_alerts_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_alerts_patient ON public.medication_availability_alerts USING btree (patient_user_id);


--
-- Name: idx_medication_availability_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_catalog_id ON public.medication_availability USING btree (medication_catalog_id);


--
-- Name: idx_medication_availability_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_name ON public.medication_availability USING btree (medication_name);


--
-- Name: idx_medication_availability_pharmacy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_pharmacy ON public.medication_availability USING btree (pharmacy_id);


--
-- Name: idx_medication_availability_pharmacy_catalog; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_pharmacy_catalog ON public.medication_availability USING btree (pharmacy_id, medication_catalog_id) WHERE (is_available = true);


--
-- Name: idx_medication_availability_view_city_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_view_city_state ON public.medication_availability_view USING btree (pharmacy_city, pharmacy_state);


--
-- Name: idx_medication_availability_view_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_availability_view_id ON public.medication_availability_view USING btree (id);


--
-- Name: idx_medication_availability_view_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_view_name ON public.medication_availability_view USING btree (medication_name);


--
-- Name: idx_medication_availability_view_pharmacy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_availability_view_pharmacy ON public.medication_availability_view USING btree (pharmacy_id);


--
-- Name: idx_medication_catalog_generic_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_catalog_generic_name ON public.medication_catalog USING btree (generic_name);


--
-- Name: idx_medication_catalog_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_catalog_is_active ON public.medication_catalog USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_medication_catalog_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_catalog_name ON public.medication_catalog USING btree (name);


--
-- Name: idx_medication_logs_schedule_med; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_schedule_med ON public.medication_logs USING btree (schedule_id, medication_id);


--
-- Name: idx_medication_logs_scheduled_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_scheduled_time ON public.medication_logs USING btree (scheduled_time);


--
-- Name: idx_medication_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_status ON public.medication_logs USING btree (status);


--
-- Name: idx_medication_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON public.medication_logs USING btree (user_id);


--
-- Name: idx_medication_logs_user_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_user_scheduled ON public.medication_logs USING btree (user_id, scheduled_time DESC);


--
-- Name: idx_medication_logs_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_user_status ON public.medication_logs USING btree (user_id, status);


--
-- Name: idx_medication_logs_user_status_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_logs_user_status_time ON public.medication_logs USING btree (user_id, status, scheduled_time DESC);


--
-- Name: idx_medication_schedules_medication; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication ON public.medication_schedules USING btree (medication_id);


--
-- Name: idx_medication_schedules_medication_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication_active ON public.medication_schedules USING btree (medication_id, is_active) WHERE (is_active = true);


--
-- Name: idx_medication_schedules_medication_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication_id ON public.medication_schedules USING btree (medication_id);


--
-- Name: idx_medication_schedules_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medication_schedules_user_id ON public.medication_schedules USING btree (user_id);


--
-- Name: idx_medications_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_catalog_id ON public.medications USING btree (medication_catalog_id);


--
-- Name: idx_medications_full_view_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_full_view_id ON public.medications_full_view USING btree (id);


--
-- Name: idx_medications_full_view_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_full_view_is_active ON public.medications_full_view USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_medications_full_view_prescriber; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_full_view_prescriber ON public.medications_full_view USING btree (prescriber_user_id);


--
-- Name: idx_medications_full_view_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_full_view_user_id ON public.medications_full_view USING btree (user_id);


--
-- Name: idx_medications_pharmacy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_pharmacy_id ON public.medications USING btree (pharmacy_id);


--
-- Name: idx_medications_prescriber_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_prescriber_user_id ON public.medications USING btree (prescriber_user_id);


--
-- Name: idx_medications_prescription_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_prescription_status ON public.medications USING btree (prescription_status);


--
-- Name: idx_medications_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_user_active ON public.medications USING btree (user_id, is_active);


--
-- Name: idx_medications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_user_id ON public.medications USING btree (user_id);


--
-- Name: idx_medications_user_prescriber; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_medications_user_prescriber ON public.medications USING btree (user_id, prescriber_user_id) WHERE (prescriber_user_id IS NOT NULL);


--
-- Name: idx_mfa_recovery_codes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_codes_user_id ON public.mfa_recovery_codes USING btree (user_id);


--
-- Name: idx_notification_history_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON public.notification_history USING btree (user_id, channel, created_at DESC);


--
-- Name: idx_notification_history_channel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_channel_type ON public.notification_history USING btree (channel, notification_type);


--
-- Name: idx_notification_history_delivery_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_delivery_status ON public.notification_history USING btree (status, delivered_at);


--
-- Name: idx_notification_history_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_metadata ON public.notification_history USING gin (metadata);


--
-- Name: idx_notification_history_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_retry ON public.notification_history USING btree (next_retry_at, retry_count, status) WHERE ((status = 'failed'::text) AND (next_retry_at IS NOT NULL));


--
-- Name: idx_notification_history_retry_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_retry_queue ON public.notification_history USING btree (next_retry_at) WHERE ((status = 'failed'::text) AND (retry_count < max_retries));


--
-- Name: idx_notification_history_status_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_status_retry ON public.notification_history USING btree (status, next_retry_at) WHERE ((status = 'failed'::text) AND (next_retry_at IS NOT NULL));


--
-- Name: idx_notification_history_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_notification_history_user_created ON public.notification_history USING btree (user_id, created_at DESC);


--
-- Name: idx_org_invoices_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_invoices_org_id ON public.organization_invoices USING btree (organization_id);


--
-- Name: idx_org_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_invoices_status ON public.organization_invoices USING btree (organization_id, status, created_at DESC);


--
-- Name: idx_org_members_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_members_org_active ON public.organization_members USING btree (organization_id, is_active);


--
-- Name: idx_org_members_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_members_user_active ON public.organization_members USING btree (user_id, is_active);


--
-- Name: idx_org_subscriptions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON public.organization_subscriptions USING btree (organization_id);


--
-- Name: idx_org_subscriptions_org_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_status ON public.organization_subscriptions USING btree (organization_id, status);


--
-- Name: idx_org_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON public.organization_subscriptions USING btree (organization_id, status);


--
-- Name: idx_org_subscriptions_stripe_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_sub ON public.organization_subscriptions USING btree (stripe_subscription_id);


--
-- Name: idx_organization_invoices_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_invoices_due_date ON public.organization_invoices USING btree (due_date) WHERE (status <> 'paid'::text);


--
-- Name: idx_organization_invoices_full_view_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_invoices_full_view_due_date ON public.organization_invoices_full_view USING btree (due_date);


--
-- Name: idx_organization_invoices_full_view_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_invoices_full_view_id ON public.organization_invoices_full_view USING btree (id);


--
-- Name: idx_organization_invoices_full_view_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_invoices_full_view_org_id ON public.organization_invoices_full_view USING btree (organization_id);


--
-- Name: idx_organization_invoices_full_view_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_invoices_full_view_status ON public.organization_invoices_full_view USING btree (status);


--
-- Name: idx_organization_invoices_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_invoices_org_id ON public.organization_invoices USING btree (organization_id);


--
-- Name: idx_organization_members_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON public.organization_members USING btree (organization_id);


--
-- Name: idx_organization_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members USING btree (user_id);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_patient_preferred_pharmacies_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_preferred_pharmacies_patient ON public.patient_preferred_pharmacies USING btree (patient_user_id);


--
-- Name: idx_patient_risk_flags_clinician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_risk_flags_clinician ON public.patient_risk_flags USING btree (clinician_user_id);


--
-- Name: idx_patient_risk_flags_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_risk_flags_patient ON public.patient_risk_flags USING btree (patient_user_id);


--
-- Name: idx_patient_risk_flags_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_risk_flags_unresolved ON public.patient_risk_flags USING btree (is_resolved) WHERE (is_resolved = false);


--
-- Name: idx_patient_vitals_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at ON public.patient_vitals USING btree (recorded_at DESC);


--
-- Name: idx_patient_vitals_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_vitals_user_id ON public.patient_vitals USING btree (user_id);


--
-- Name: idx_patient_vitals_user_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_vitals_user_recorded ON public.patient_vitals USING btree (user_id, recorded_at DESC);


--
-- Name: idx_patient_vitals_with_bmi_view_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_vitals_with_bmi_view_id ON public.patient_vitals_with_bmi_view USING btree (id);


--
-- Name: idx_patient_vitals_with_bmi_view_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_vitals_with_bmi_view_recorded_at ON public.patient_vitals_with_bmi_view USING btree (recorded_at DESC);


--
-- Name: idx_patient_vitals_with_bmi_view_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_patient_vitals_with_bmi_view_user_id ON public.patient_vitals_with_bmi_view USING btree (user_id);


--
-- Name: idx_pharmacy_locations_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_city ON public.pharmacy_locations USING btree (city);


--
-- Name: idx_pharmacy_locations_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_state ON public.pharmacy_locations USING btree (state);


--
-- Name: idx_polypharmacy_warnings_unacked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_polypharmacy_warnings_unacked ON public.polypharmacy_warnings USING btree (patient_user_id) WHERE (is_acknowledged = false);


--
-- Name: idx_prescriptions_clinician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinician ON public.prescriptions USING btree (clinician_user_id);


--
-- Name: idx_prescriptions_clinician_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinician_date ON public.prescriptions USING btree (clinician_user_id, date_written DESC);


--
-- Name: idx_prescriptions_clinician_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinician_status ON public.prescriptions USING btree (clinician_user_id, status, created_at DESC);


--
-- Name: idx_prescriptions_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_number ON public.prescriptions USING btree (prescription_number);


--
-- Name: idx_prescriptions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions USING btree (patient_user_id);


--
-- Name: idx_prescriptions_patient_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_status ON public.prescriptions USING btree (patient_user_id, status, created_at DESC);


--
-- Name: idx_prescriptions_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_pending ON public.prescriptions USING btree (pharmacy_id, created_at DESC) WHERE (status = 'pending'::text);


--
-- Name: idx_prescriptions_pharmacy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON public.prescriptions USING btree (pharmacy_id);


--
-- Name: idx_prescriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON public.prescriptions USING btree (status);


--
-- Name: idx_profiles_org_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_profiles_org_user ON public.profiles USING btree (organization_id, user_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_profiles_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_profiles_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles USING btree (organization_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_push_subscriptions_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform ON public.push_subscriptions USING btree (platform);


--
-- Name: idx_push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_refill_requests_medication; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_refill_requests_medication ON public.refill_requests USING btree (medication_id);


--
-- Name: idx_refill_requests_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_refill_requests_patient ON public.refill_requests USING btree (patient_user_id);


--
-- Name: idx_refill_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_refill_requests_status ON public.refill_requests USING btree (status);


--
-- Name: idx_sec_notif_prefs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_sec_notif_prefs_user_id ON public.security_notification_preferences USING btree (user_id);


--
-- Name: idx_security_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events USING btree (created_at);


--
-- Name: idx_security_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_metadata ON public.security_events USING gin (metadata);


--
-- Name: idx_security_events_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_metadata_gin ON public.security_events USING gin (metadata);


--
-- Name: idx_security_events_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events USING btree (severity);


--
-- Name: idx_security_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events USING btree (event_type);


--
-- Name: idx_security_events_type_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON public.security_events USING btree (event_type, severity, created_at DESC);


--
-- Name: idx_security_events_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON public.security_events USING btree (user_id, created_at DESC);


--
-- Name: idx_security_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events USING btree (user_id);


--
-- Name: idx_symptom_entries_recorded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_symptom_entries_recorded_at ON public.symptom_entries USING btree (recorded_at);


--
-- Name: idx_symptom_entries_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_symptom_entries_type ON public.symptom_entries USING btree (symptom_type);


--
-- Name: idx_symptom_entries_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_symptom_entries_user_id ON public.symptom_entries USING btree (user_id);


--
-- Name: idx_symptom_entries_user_recorded; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_symptom_entries_user_recorded ON public.symptom_entries USING btree (user_id, recorded_at DESC);


--
-- Name: idx_trusted_devices_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_token ON public.trusted_devices USING btree (user_id, device_token_hash) WHERE (is_active = true);


--
-- Name: idx_trusted_devices_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_active ON public.trusted_devices USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_user_login_locations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_login_locations_created_at ON public.user_login_locations USING btree (created_at DESC);


--
-- Name: idx_user_login_locations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_login_locations_user_id ON public.user_login_locations USING btree (user_id);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles USING btree (role);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_sessions_device_info_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_device_info_gin ON public.user_sessions USING gin (device_info);


--
-- Name: idx_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_user_sessions_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON public.user_sessions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_user_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);


--
-- Name: idx_video_rooms_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_video_rooms_created ON public.video_rooms USING btree (created_at DESC) WHERE (status = 'active'::text);


--
-- Name: idx_video_rooms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_video_rooms_status ON public.video_rooms USING btree (status, created_at DESC) WHERE (status = 'active'::text);


--
-- Name: idx_vitals_alerts_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vitals_alerts_severity ON public.vitals_alerts USING btree (severity);


--
-- Name: idx_vitals_alerts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS idx_vitals_alerts_user_id ON public.vitals_alerts USING btree (user_id);


--
-- Name: clinician_patient_assignments audit_clinician_patient_assignments; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_clinician_patient_assignments ON public.clinician_patient_assignments;
CREATE TRIGGER audit_clinician_patient_assignments AFTER INSERT OR DELETE OR UPDATE ON public.clinician_patient_assignments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: controlled_drug_adjustments audit_controlled_drug_adjustments; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_controlled_drug_adjustments ON public.controlled_drug_adjustments;
CREATE TRIGGER audit_controlled_drug_adjustments AFTER INSERT ON public.controlled_drug_adjustments FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: controlled_drug_dispensing audit_controlled_drug_dispensing; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_controlled_drug_dispensing ON public.controlled_drug_dispensing;
CREATE TRIGGER audit_controlled_drug_dispensing AFTER INSERT ON public.controlled_drug_dispensing FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: controlled_drugs audit_controlled_drugs; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_controlled_drugs ON public.controlled_drugs;
CREATE TRIGGER audit_controlled_drugs AFTER INSERT OR DELETE OR UPDATE ON public.controlled_drugs FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: profiles audit_profiles; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: user_roles audit_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS on_auth_user_created ON public.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: medication_availability_alerts trg_auto_link_alert_catalog; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_auto_link_alert_catalog ON public.medication_availability_alerts;
CREATE TRIGGER trg_auto_link_alert_catalog BEFORE INSERT ON public.medication_availability_alerts FOR EACH ROW EXECUTE FUNCTION public.auto_link_alert_catalog();


--
-- Name: medication_availability trg_auto_link_availability_catalog; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_auto_link_availability_catalog ON public.medication_availability;
CREATE TRIGGER trg_auto_link_availability_catalog BEFORE INSERT ON public.medication_availability FOR EACH ROW EXECUTE FUNCTION public.auto_link_availability_catalog();


--
-- Name: medications trg_auto_link_medication_catalog; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_auto_link_medication_catalog ON public.medications;
CREATE TRIGGER trg_auto_link_medication_catalog BEFORE INSERT ON public.medications FOR EACH ROW EXECUTE FUNCTION public.auto_link_medication_catalog();


--
-- Name: drug_transfers trg_auto_link_transfer_catalog; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trg_auto_link_transfer_catalog ON public.drug_transfers;
CREATE TRIGGER trg_auto_link_transfer_catalog BEFORE INSERT ON public.drug_transfers FOR EACH ROW EXECUTE FUNCTION public.auto_link_transfer_catalog();


--
-- Name: controlled_drug_adjustments trigger_update_stock_on_adjustment; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_update_stock_on_adjustment ON public.controlled_drug_adjustments;
CREATE TRIGGER trigger_update_stock_on_adjustment AFTER INSERT ON public.controlled_drug_adjustments FOR EACH ROW EXECUTE FUNCTION public.update_controlled_drug_stock_on_adjustment();


--
-- Name: controlled_drug_dispensing trigger_update_stock_on_dispense; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS trigger_update_stock_on_dispense ON public.controlled_drug_dispensing;
CREATE TRIGGER trigger_update_stock_on_dispense AFTER INSERT ON public.controlled_drug_dispensing FOR EACH ROW EXECUTE FUNCTION public.update_controlled_drug_stock_on_dispense();


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: caregiver_invitations update_caregiver_invitations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_caregiver_invitations_updated_at ON public.caregiver_invitations;
CREATE TRIGGER update_caregiver_invitations_updated_at BEFORE UPDATE ON public.caregiver_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: controlled_drugs update_controlled_drugs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_controlled_drugs_updated_at ON public.controlled_drugs;
CREATE TRIGGER update_controlled_drugs_updated_at BEFORE UPDATE ON public.controlled_drugs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drug_recalls update_drug_recalls_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_drug_recalls_updated_at ON public.drug_recalls;
CREATE TRIGGER update_drug_recalls_updated_at BEFORE UPDATE ON public.drug_recalls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drug_transfers update_drug_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_drug_transfers_updated_at ON public.drug_transfers;
CREATE TRIGGER update_drug_transfers_updated_at BEFORE UPDATE ON public.drug_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_engagement_scores update_engagement_scores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_engagement_scores_updated_at ON public.patient_engagement_scores;
CREATE TRIGGER update_engagement_scores_updated_at BEFORE UPDATE ON public.patient_engagement_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lab_results update_lab_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_lab_results_updated_at ON public.lab_results;
CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medication_availability_alerts update_medication_availability_alerts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_medication_availability_alerts_updated_at ON public.medication_availability_alerts;
CREATE TRIGGER update_medication_availability_alerts_updated_at BEFORE UPDATE ON public.medication_availability_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medication_availability update_medication_availability_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_medication_availability_updated_at ON public.medication_availability;
CREATE TRIGGER update_medication_availability_updated_at BEFORE UPDATE ON public.medication_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medication_catalog update_medication_catalog_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_medication_catalog_updated_at ON public.medication_catalog;
CREATE TRIGGER update_medication_catalog_updated_at BEFORE UPDATE ON public.medication_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: medications update_medications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_medications_updated_at ON public.medications;
CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_settings update_notification_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON public.notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_invoices update_org_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_org_invoices_updated_at ON public.organization_invoices;
CREATE TRIGGER update_org_invoices_updated_at BEFORE UPDATE ON public.organization_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_payment_methods update_org_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_org_payment_methods_updated_at ON public.organization_payment_methods;
CREATE TRIGGER update_org_payment_methods_updated_at BEFORE UPDATE ON public.organization_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_subscriptions update_org_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_org_subscriptions_updated_at ON public.organization_subscriptions;
CREATE TRIGGER update_org_subscriptions_updated_at BEFORE UPDATE ON public.organization_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_branding update_organization_branding_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_organization_branding_updated_at ON public.organization_branding;
CREATE TRIGGER update_organization_branding_updated_at BEFORE UPDATE ON public.organization_branding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_members update_organization_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_organization_members_updated_at ON public.organization_members;
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_allergies update_patient_allergies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_patient_allergies_updated_at ON public.patient_allergies;
CREATE TRIGGER update_patient_allergies_updated_at BEFORE UPDATE ON public.patient_allergies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_chronic_conditions update_patient_chronic_conditions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_patient_chronic_conditions_updated_at ON public.patient_chronic_conditions;
CREATE TRIGGER update_patient_chronic_conditions_updated_at BEFORE UPDATE ON public.patient_chronic_conditions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_emergency_contacts update_patient_emergency_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_patient_emergency_contacts_updated_at ON public.patient_emergency_contacts;
CREATE TRIGGER update_patient_emergency_contacts_updated_at BEFORE UPDATE ON public.patient_emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_notification_preferences update_patient_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_patient_notification_preferences_updated_at ON public.patient_notification_preferences;
CREATE TRIGGER update_patient_notification_preferences_updated_at BEFORE UPDATE ON public.patient_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_risk_flags update_patient_risk_flags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_patient_risk_flags_updated_at ON public.patient_risk_flags;
CREATE TRIGGER update_patient_risk_flags_updated_at BEFORE UPDATE ON public.patient_risk_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patient_vitals update_patient_vitals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_patient_vitals_updated_at ON public.patient_vitals;
CREATE TRIGGER update_patient_vitals_updated_at BEFORE UPDATE ON public.patient_vitals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pharmacy_locations update_pharmacy_locations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_pharmacy_locations_updated_at ON public.pharmacy_locations;
CREATE TRIGGER update_pharmacy_locations_updated_at BEFORE UPDATE ON public.pharmacy_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: polypharmacy_warnings update_polypharmacy_warnings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_polypharmacy_warnings_updated_at ON public.polypharmacy_warnings;
CREATE TRIGGER update_polypharmacy_warnings_updated_at BEFORE UPDATE ON public.polypharmacy_warnings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prescriptions update_prescriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: push_subscriptions update_push_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: refill_requests update_refill_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_refill_requests_updated_at ON public.refill_requests;
CREATE TRIGGER update_refill_requests_updated_at BEFORE UPDATE ON public.refill_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: security_notification_preferences update_security_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_security_notification_preferences_updated_at ON public.security_notification_preferences;
CREATE TRIGGER update_security_notification_preferences_updated_at BEFORE UPDATE ON public.security_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: soap_notes update_soap_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_soap_notes_updated_at ON public.soap_notes;
CREATE TRIGGER update_soap_notes_updated_at BEFORE UPDATE ON public.soap_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: video_call_notes update_video_call_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_video_call_notes_updated_at ON public.video_call_notes;
CREATE TRIGGER update_video_call_notes_updated_at BEFORE UPDATE ON public.video_call_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: video_rooms update_video_rooms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

DROP TRIGGER IF EXISTS update_video_rooms_updated_at ON public.video_rooms;
CREATE TRIGGER update_video_rooms_updated_at BEFORE UPDATE ON public.video_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_lockouts account_lockouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_lockouts
    ADD CONSTRAINT account_lockouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: appointments appointments_video_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_video_room_id_fkey FOREIGN KEY (video_room_id) REFERENCES public.video_rooms(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: availability_notification_history availability_notification_history_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_notification_history
    ADD CONSTRAINT availability_notification_history_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.medication_availability_alerts(id) ON DELETE CASCADE;


--
-- Name: availability_notification_history availability_notification_history_availability_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_notification_history
    ADD CONSTRAINT availability_notification_history_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES public.medication_availability(id) ON DELETE CASCADE;


--
-- Name: billing_events billing_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: caregiver_invitations caregiver_invitations_caregiver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_invitations
    ADD CONSTRAINT caregiver_invitations_caregiver_user_id_fkey FOREIGN KEY (caregiver_user_id) REFERENCES public.users(id);


--
-- Name: caregiver_invitations caregiver_invitations_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_invitations
    ADD CONSTRAINT caregiver_invitations_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clinician_patient_assignments clinician_patient_assignments_clinician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_patient_assignments
    ADD CONSTRAINT clinician_patient_assignments_clinician_user_id_fkey FOREIGN KEY (clinician_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clinician_patient_assignments clinician_patient_assignments_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_patient_assignments
    ADD CONSTRAINT clinician_patient_assignments_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: controlled_drug_adjustments controlled_drug_adjustments_controlled_drug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_adjustments
    ADD CONSTRAINT controlled_drug_adjustments_controlled_drug_id_fkey FOREIGN KEY (controlled_drug_id) REFERENCES public.controlled_drugs(id) ON DELETE RESTRICT;


--
-- Name: controlled_drug_adjustments controlled_drug_adjustments_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_adjustments
    ADD CONSTRAINT controlled_drug_adjustments_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: controlled_drug_adjustments controlled_drug_adjustments_witness_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_adjustments
    ADD CONSTRAINT controlled_drug_adjustments_witness_id_fkey FOREIGN KEY (witness_id) REFERENCES public.users(id);


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_controlled_drug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_controlled_drug_id_fkey FOREIGN KEY (controlled_drug_id) REFERENCES public.controlled_drugs(id) ON DELETE RESTRICT;


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_dispensing_pharmacist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_dispensing_pharmacist_id_fkey FOREIGN KEY (dispensing_pharmacist_id) REFERENCES public.users(id);


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_patient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_patient_user_id_fkey FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_prescriber_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_prescriber_user_id_fkey FOREIGN KEY (prescriber_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;


--
-- Name: controlled_drug_dispensing controlled_drug_dispensing_witness_pharmacist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drug_dispensing
    ADD CONSTRAINT controlled_drug_dispensing_witness_pharmacist_id_fkey FOREIGN KEY (witness_pharmacist_id) REFERENCES public.users(id);


--
-- Name: controlled_drugs controlled_drugs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_drugs
    ADD CONSTRAINT controlled_drugs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drug_recall_notifications drug_recall_notifications_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_recall_notifications
    ADD CONSTRAINT drug_recall_notifications_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacy_locations(id);


--
-- Name: drug_recall_notifications drug_recall_notifications_recall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_recall_notifications
    ADD CONSTRAINT drug_recall_notifications_recall_id_fkey FOREIGN KEY (recall_id) REFERENCES public.drug_recalls(id) ON DELETE CASCADE;


--
-- Name: drug_transfers drug_transfers_destination_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_transfers
    ADD CONSTRAINT drug_transfers_destination_pharmacy_id_fkey FOREIGN KEY (destination_pharmacy_id) REFERENCES public.pharmacy_locations(id);


--
-- Name: drug_transfers drug_transfers_medication_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_transfers
    ADD CONSTRAINT drug_transfers_medication_catalog_id_fkey FOREIGN KEY (medication_catalog_id) REFERENCES public.medication_catalog(id) ON DELETE SET NULL;


--
-- Name: drug_transfers drug_transfers_source_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_transfers
    ADD CONSTRAINT drug_transfers_source_pharmacy_id_fkey FOREIGN KEY (source_pharmacy_id) REFERENCES public.pharmacy_locations(id);


--
-- Name: email_ab_assignments email_ab_assignments_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ab_assignments
    ADD CONSTRAINT email_ab_assignments_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notification_history(id) ON DELETE CASCADE;


--
-- Name: email_ab_assignments email_ab_assignments_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ab_assignments
    ADD CONSTRAINT email_ab_assignments_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.email_ab_tests(id) ON DELETE CASCADE;


--
-- Name: email_ab_tests email_ab_tests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_ab_tests
    ADD CONSTRAINT email_ab_tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: external_user_mapping external_user_mapping_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user_mapping
    ADD CONSTRAINT external_user_mapping_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: availability_notification_history fk_avail_notif_history_patient_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_notification_history
    ADD CONSTRAINT fk_avail_notif_history_patient_user_id FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: caregiver_messages fk_caregiver_messages_caregiver_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_messages
    ADD CONSTRAINT fk_caregiver_messages_caregiver_user_id FOREIGN KEY (caregiver_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: caregiver_messages fk_caregiver_messages_patient_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caregiver_messages
    ADD CONSTRAINT fk_caregiver_messages_patient_user_id FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clinician_messages fk_clinician_messages_clinician_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_messages
    ADD CONSTRAINT fk_clinician_messages_clinician_user_id FOREIGN KEY (clinician_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: clinician_messages fk_clinician_messages_patient_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinician_messages
    ADD CONSTRAINT fk_clinician_messages_patient_user_id FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_access_log fk_data_access_log_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_access_log
    ADD CONSTRAINT fk_data_access_log_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: lab_results fk_lab_results_ordered_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT fk_lab_results_ordered_by FOREIGN KEY (ordered_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lab_results fk_lab_results_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT fk_lab_results_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: medication_availability_alerts fk_med_avail_alerts_patient_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability_alerts
    ADD CONSTRAINT fk_med_avail_alerts_patient_user_id FOREIGN KEY (patient_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_codes fk_mfa_recovery_codes_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfa_recovery_codes
    ADD CONSTRAINT fk_mfa_recovery_codes_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_history fk_notification_history_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_history
    ADD CONSTRAINT fk_notification_history_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_activity_log fk_patient_activity_log_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_activity_log
    ADD CONSTRAINT fk_patient_activity_log_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_allergies fk_patient_allergies_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_allergies
    ADD CONSTRAINT fk_patient_allergies_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_chronic_conditions fk_patient_chronic_conditions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_chronic_conditions
    ADD CONSTRAINT fk_patient_chronic_conditions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_emergency_contacts fk_patient_emergency_contacts_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_emergency_contacts
    ADD CONSTRAINT fk_patient_emergency_contacts_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_engagement_scores fk_patient_engagement_scores_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_engagement_scores
    ADD CONSTRAINT fk_patient_engagement_scores_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_notification_preferences fk_patient_notif_prefs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notification_preferences
    ADD CONSTRAINT fk_patient_notif_prefs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: patient_vitals fk_patient_vitals_recorded_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vitals
    ADD CONSTRAINT fk_patient_vitals_recorded_by FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: patient_vitals fk_patient_vitals_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_vitals
    ADD CONSTRAINT fk_patient_vitals_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pharmacy_locations fk_pharmacy_locations_pharmacist_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_locations
    ADD CONSTRAINT fk_pharmacy_locations_pharmacist_user_id FOREIGN KEY (pharmacist_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: push_subscriptions fk_push_subscriptions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT fk_push_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_notification_preferences fk_sec_notif_prefs_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_notification_preferences
    ADD CONSTRAINT fk_sec_notif_prefs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_events fk_security_events_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT fk_security_events_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_login_locations fk_user_login_locations_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_login_locations
    ADD CONSTRAINT fk_user_login_locations_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions fk_user_sessions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: login_attempts login_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: medication_availability_alerts medication_availability_alerts_medication_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability_alerts
    ADD CONSTRAINT medication_availability_alerts_medication_catalog_id_fkey FOREIGN KEY (medication_catalog_id) REFERENCES public.medication_catalog(id) ON DELETE SET NULL;


--
-- Name: medication_availability medication_availability_medication_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability
    ADD CONSTRAINT medication_availability_medication_catalog_id_fkey FOREIGN KEY (medication_catalog_id) REFERENCES public.medication_catalog(id) ON DELETE SET NULL;


--
-- Name: medication_availability medication_availability_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_availability
    ADD CONSTRAINT medication_availability_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacy_locations(id) ON DELETE CASCADE;


--
-- Name: medication_logs medication_logs_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_logs
    ADD CONSTRAINT medication_logs_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE CASCADE;


--
-- Name: medication_logs medication_logs_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_logs
    ADD CONSTRAINT medication_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.medication_schedules(id) ON DELETE CASCADE;


--
-- Name: medication_logs medication_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_logs
    ADD CONSTRAINT medication_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: medication_schedules medication_schedules_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_schedules
    ADD CONSTRAINT medication_schedules_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE CASCADE;


--
-- Name: medication_schedules medication_schedules_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_schedules
    ADD CONSTRAINT medication_schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: medications medications_medication_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_medication_catalog_id_fkey FOREIGN KEY (medication_catalog_id) REFERENCES public.medication_catalog(id) ON DELETE SET NULL;


--
-- Name: medications medications_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacy_locations(id) ON DELETE SET NULL;


--
-- Name: medications medications_prescriber_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_prescriber_user_id_fkey FOREIGN KEY (prescriber_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: medications medications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notification_settings notification_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: organization_branding organization_branding_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_branding
    ADD CONSTRAINT organization_branding_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_invoices organization_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invoices
    ADD CONSTRAINT organization_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: organization_payment_methods organization_payment_methods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_payment_methods
    ADD CONSTRAINT organization_payment_methods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_subscriptions organization_subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_subscriptions
    ADD CONSTRAINT organization_subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: patient_preferred_pharmacies patient_preferred_pharmacies_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_preferred_pharmacies
    ADD CONSTRAINT patient_preferred_pharmacies_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacy_locations(id) ON DELETE CASCADE;


--
-- Name: post_call_summaries post_call_summaries_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_call_summaries
    ADD CONSTRAINT post_call_summaries_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.video_rooms(id) ON DELETE CASCADE;


--
-- Name: prescription_status_history prescription_status_history_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_status_history
    ADD CONSTRAINT prescription_status_history_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacy_locations(id);


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: red_flag_alerts red_flag_alerts_symptom_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.red_flag_alerts
    ADD CONSTRAINT red_flag_alerts_symptom_entry_id_fkey FOREIGN KEY (symptom_entry_id) REFERENCES public.symptom_entries(id) ON DELETE CASCADE;


--
-- Name: refill_requests refill_requests_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refill_requests
    ADD CONSTRAINT refill_requests_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE CASCADE;


--
-- Name: security_events security_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.user_sessions(id) ON DELETE SET NULL;


--
-- Name: symptom_entries symptom_entries_medication_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.symptom_entries
    ADD CONSTRAINT symptom_entries_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES public.medications(id) ON DELETE SET NULL;


--
-- Name: symptom_entries symptom_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.symptom_entries
    ADD CONSTRAINT symptom_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: video_call_notes video_call_notes_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_call_notes
    ADD CONSTRAINT video_call_notes_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.video_rooms(id) ON DELETE CASCADE;


--
-- Name: video_room_participants video_room_participants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_room_participants
    ADD CONSTRAINT video_room_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.video_rooms(id) ON DELETE CASCADE;


--
-- Name: video_rooms video_rooms_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_rooms
    ADD CONSTRAINT video_rooms_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: vitals_alerts vitals_alerts_vital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals_alerts
    ADD CONSTRAINT vitals_alerts_vital_id_fkey FOREIGN KEY (vital_id) REFERENCES public.patient_vitals(id) ON DELETE CASCADE;


--
-- Name: waiting_room_queue waiting_room_queue_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waiting_room_queue
    ADD CONSTRAINT waiting_room_queue_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.video_rooms(id) ON DELETE CASCADE;


--
-- Name: email_ab_tests Admins can create A/B tests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can create A/B tests" ON public.email_ab_tests;
CREATE POLICY "Admins can create A/B tests" ON public.email_ab_tests FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: clinician_patient_assignments Admins can create assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can create assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Admins can create assignments" ON public.clinician_patient_assignments FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: email_ab_assignments Admins can delete A/B assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can delete A/B assignments" ON public.email_ab_assignments;
CREATE POLICY "Admins can delete A/B assignments" ON public.email_ab_assignments FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: email_ab_tests Admins can delete A/B tests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can delete A/B tests" ON public.email_ab_tests;
CREATE POLICY "Admins can delete A/B tests" ON public.email_ab_tests FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: clinician_patient_assignments Admins can delete assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can delete assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Admins can delete assignments" ON public.clinician_patient_assignments FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin(auth.uid()));


--
-- Name: email_ab_assignments Admins can insert A/B assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can insert A/B assignments" ON public.email_ab_assignments;
CREATE POLICY "Admins can insert A/B assignments" ON public.email_ab_assignments FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: notification_settings Admins can insert notification settings; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can insert notification settings" ON public.notification_settings;
CREATE POLICY "Admins can insert notification settings" ON public.notification_settings FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: profiles Admins can insert profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: caregiver_invitations Admins can manage all invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can manage all invitations" ON public.caregiver_invitations;
CREATE POLICY "Admins can manage all invitations" ON public.caregiver_invitations USING (public.is_admin(auth.uid()));


--
-- Name: compliance_reports Admins can manage compliance reports; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can manage compliance reports" ON public.compliance_reports;
CREATE POLICY "Admins can manage compliance reports" ON public.compliance_reports USING (public.is_admin(auth.uid()));


--
-- Name: drug_interactions Admins can manage drug interactions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can manage drug interactions" ON public.drug_interactions;
CREATE POLICY "Admins can manage drug interactions" ON public.drug_interactions USING (public.is_admin(auth.uid()));


--
-- Name: security_settings Admins can manage security settings; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can manage security settings" ON public.security_settings;
CREATE POLICY "Admins can manage security settings" ON public.security_settings USING (public.is_admin(auth.uid()));


--
-- Name: user_sessions Admins can manage sessions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can manage sessions" ON public.user_sessions;
CREATE POLICY "Admins can manage sessions" ON public.user_sessions USING (public.is_admin(auth.uid()));


--
-- Name: email_ab_assignments Admins can update A/B assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can update A/B assignments" ON public.email_ab_assignments;
CREATE POLICY "Admins can update A/B assignments" ON public.email_ab_assignments FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: email_ab_tests Admins can update A/B tests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can update A/B tests" ON public.email_ab_tests;
CREATE POLICY "Admins can update A/B tests" ON public.email_ab_tests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: account_lockouts Admins can update lockouts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can update lockouts" ON public.account_lockouts;
CREATE POLICY "Admins can update lockouts" ON public.account_lockouts FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: notification_settings Admins can update notification settings; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can update notification settings" ON public.notification_settings;
CREATE POLICY "Admins can update notification settings" ON public.notification_settings FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin(auth.uid()));


--
-- Name: email_ab_assignments Admins can view all A/B assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all A/B assignments" ON public.email_ab_assignments;
CREATE POLICY "Admins can view all A/B assignments" ON public.email_ab_assignments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: email_ab_tests Admins can view all A/B tests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all A/B tests" ON public.email_ab_tests;
CREATE POLICY "Admins can view all A/B tests" ON public.email_ab_tests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: patient_activity_log Admins can view all activity; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all activity" ON public.patient_activity_log;
CREATE POLICY "Admins can view all activity" ON public.patient_activity_log FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: appointments Admins can view all appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
CREATE POLICY "Admins can view all appointments" ON public.appointments FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: clinician_patient_assignments Admins can view all assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Admins can view all assignments" ON public.clinician_patient_assignments FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: audit_log Admins can view all audit logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
CREATE POLICY "Admins can view all audit logs" ON public.audit_log FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: caregiver_invitations Admins can view all caregiver invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all caregiver invitations" ON public.caregiver_invitations;
CREATE POLICY "Admins can view all caregiver invitations" ON public.caregiver_invitations FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: data_access_log Admins can view all data access logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all data access logs" ON public.data_access_log;
CREATE POLICY "Admins can view all data access logs" ON public.data_access_log FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: patient_engagement_scores Admins can view all engagement scores; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all engagement scores" ON public.patient_engagement_scores;
CREATE POLICY "Admins can view all engagement scores" ON public.patient_engagement_scores FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: account_lockouts Admins can view all lockouts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all lockouts" ON public.account_lockouts;
CREATE POLICY "Admins can view all lockouts" ON public.account_lockouts FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: login_attempts Admins can view all login attempts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view all login attempts" ON public.login_attempts FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: user_login_locations Admins can view all login locations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all login locations" ON public.user_login_locations;
CREATE POLICY "Admins can view all login locations" ON public.user_login_locations FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: patient_notification_preferences Admins can view all notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Admins can view all notification preferences" ON public.patient_notification_preferences FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: polypharmacy_warnings Admins can view all polypharmacy warnings; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all polypharmacy warnings" ON public.polypharmacy_warnings;
CREATE POLICY "Admins can view all polypharmacy warnings" ON public.polypharmacy_warnings FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: prescriptions Admins can view all prescriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all prescriptions" ON public.prescriptions;
CREATE POLICY "Admins can view all prescriptions" ON public.prescriptions FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: refill_requests Admins can view all refill requests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all refill requests" ON public.refill_requests;
CREATE POLICY "Admins can view all refill requests" ON public.refill_requests FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: patient_risk_flags Admins can view all risk flags; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all risk flags" ON public.patient_risk_flags;
CREATE POLICY "Admins can view all risk flags" ON public.patient_risk_flags FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: security_events Admins can view all security events; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all security events" ON public.security_events;
CREATE POLICY "Admins can view all security events" ON public.security_events FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: user_sessions Admins can view all sessions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.user_sessions;
CREATE POLICY "Admins can view all sessions" ON public.user_sessions FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: drug_transfers Admins can view all transfers; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all transfers" ON public.drug_transfers;
CREATE POLICY "Admins can view all transfers" ON public.drug_transfers FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: video_rooms Admins can view all video rooms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view all video rooms" ON public.video_rooms;
CREATE POLICY "Admins can view all video rooms" ON public.video_rooms FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: notification_settings Admins can view notification settings; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Admins can view notification settings" ON public.notification_settings;
CREATE POLICY "Admins can view notification settings" ON public.notification_settings FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: drug_interactions Anyone can view drug interactions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Anyone can view drug interactions" ON public.drug_interactions;
CREATE POLICY "Anyone can view drug interactions" ON public.drug_interactions FOR SELECT USING (true);


--
-- Name: audit_log Audit logs inserted via trigger only; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Audit logs inserted via trigger only" ON public.audit_log;
CREATE POLICY "Audit logs inserted via trigger only" ON public.audit_log FOR INSERT WITH CHECK (((user_id = auth.uid()) OR (user_id IS NULL)));


--
-- Name: medication_catalog Authenticated users can view active medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Authenticated users can view active medications" ON public.medication_catalog;
CREATE POLICY "Authenticated users can view active medications" ON public.medication_catalog FOR SELECT USING ((is_active = true));


--
-- Name: prescription_status_history Authorized users can insert history; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Authorized users can insert history" ON public.prescription_status_history;
CREATE POLICY "Authorized users can insert history" ON public.prescription_status_history FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.prescriptions p
  WHERE ((p.id = prescription_status_history.prescription_id) AND ((p.clinician_user_id = auth.uid()) OR public.is_pharmacist(auth.uid()))))));


--
-- Name: caregiver_messages Caregivers can mark patient messages as read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can mark patient messages as read" ON public.caregiver_messages;
CREATE POLICY "Caregivers can mark patient messages as read" ON public.caregiver_messages FOR UPDATE USING (((auth.uid() = caregiver_user_id) AND (sender_type = 'patient'::text))) WITH CHECK (((auth.uid() = caregiver_user_id) AND (sender_type = 'patient'::text)));


--
-- Name: caregiver_messages Caregivers can send messages to their patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can send messages to their patients" ON public.caregiver_messages;
CREATE POLICY "Caregivers can send messages to their patients" ON public.caregiver_messages FOR INSERT WITH CHECK (((auth.uid() = caregiver_user_id) AND public.is_caregiver_for_patient(patient_user_id, auth.uid())));


--
-- Name: caregiver_invitations Caregivers can update invitation status; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can update invitation status" ON public.caregiver_invitations;
CREATE POLICY "Caregivers can update invitation status" ON public.caregiver_invitations FOR UPDATE USING (((auth.uid() = caregiver_user_id) AND (status = 'pending'::text))) WITH CHECK (((auth.uid() = caregiver_user_id) AND (status = ANY (ARRAY['accepted'::text, 'declined'::text]))));


--
-- Name: patient_allergies Caregivers can view patient allergies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient allergies" ON public.patient_allergies;
CREATE POLICY "Caregivers can view patient allergies" ON public.patient_allergies FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: patient_chronic_conditions Caregivers can view patient conditions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient conditions" ON public.patient_chronic_conditions;
CREATE POLICY "Caregivers can view patient conditions" ON public.patient_chronic_conditions FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: patient_emergency_contacts Caregivers can view patient emergency contacts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient emergency contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Caregivers can view patient emergency contacts" ON public.patient_emergency_contacts FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: lab_results Caregivers can view patient lab results; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient lab results" ON public.lab_results;
CREATE POLICY "Caregivers can view patient lab results" ON public.lab_results FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: medication_logs Caregivers can view patient logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient logs" ON public.medication_logs;
CREATE POLICY "Caregivers can view patient logs" ON public.medication_logs FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: medications Caregivers can view patient medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient medications" ON public.medications;
CREATE POLICY "Caregivers can view patient medications" ON public.medications FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: profiles Caregivers can view patient profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient profiles" ON public.profiles;
CREATE POLICY "Caregivers can view patient profiles" ON public.profiles FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: symptom_entries Caregivers can view patient symptoms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient symptoms" ON public.symptom_entries;
CREATE POLICY "Caregivers can view patient symptoms" ON public.symptom_entries FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: patient_vitals Caregivers can view patient vitals; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view patient vitals" ON public.patient_vitals;
CREATE POLICY "Caregivers can view patient vitals" ON public.patient_vitals FOR SELECT USING (public.is_caregiver_for_patient(user_id, auth.uid()));


--
-- Name: caregiver_invitations Caregivers can view their invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view their invitations" ON public.caregiver_invitations;
CREATE POLICY "Caregivers can view their invitations" ON public.caregiver_invitations FOR SELECT USING ((auth.uid() = caregiver_user_id));


--
-- Name: caregiver_messages Caregivers can view their sent messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Caregivers can view their sent messages" ON public.caregiver_messages;
CREATE POLICY "Caregivers can view their sent messages" ON public.caregiver_messages FOR SELECT USING ((auth.uid() = caregiver_user_id));


--
-- Name: vitals_alerts Clinicians can acknowledge alerts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can acknowledge alerts" ON public.vitals_alerts;
CREATE POLICY "Clinicians can acknowledge alerts" ON public.vitals_alerts FOR UPDATE USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: appointments Clinicians can create appointments for assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can create appointments for assigned patients" ON public.appointments;
CREATE POLICY "Clinicians can create appointments for assigned patients" ON public.appointments FOR INSERT WITH CHECK (((auth.uid() = clinician_user_id) AND public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: soap_notes Clinicians can create notes for assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can create notes for assigned patients" ON public.soap_notes;
CREATE POLICY "Clinicians can create notes for assigned patients" ON public.soap_notes FOR INSERT WITH CHECK (((auth.uid() = clinician_user_id) AND public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: clinician_patient_assignments Clinicians can create own assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can create own assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Clinicians can create own assignments" ON public.clinician_patient_assignments FOR INSERT WITH CHECK ((public.is_clinician(auth.uid()) AND (auth.uid() = clinician_user_id)));


--
-- Name: prescriptions Clinicians can create prescriptions for assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can create prescriptions for assigned patients" ON public.prescriptions;
CREATE POLICY "Clinicians can create prescriptions for assigned patients" ON public.prescriptions FOR INSERT WITH CHECK (((auth.uid() = clinician_user_id) AND public.is_clinician(auth.uid()) AND public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: video_rooms Clinicians can create video rooms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can create video rooms" ON public.video_rooms;
CREATE POLICY "Clinicians can create video rooms" ON public.video_rooms FOR INSERT WITH CHECK (((auth.uid() = clinician_user_id) AND public.is_clinician(auth.uid())));


--
-- Name: clinician_patient_assignments Clinicians can delete own assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can delete own assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Clinicians can delete own assignments" ON public.clinician_patient_assignments FOR DELETE USING ((public.is_clinician(auth.uid()) AND (auth.uid() = clinician_user_id)));


--
-- Name: appointments Clinicians can delete their appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can delete their appointments" ON public.appointments;
CREATE POLICY "Clinicians can delete their appointments" ON public.appointments FOR DELETE USING ((auth.uid() = clinician_user_id));


--
-- Name: soap_notes Clinicians can delete their own notes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can delete their own notes" ON public.soap_notes;
CREATE POLICY "Clinicians can delete their own notes" ON public.soap_notes FOR DELETE USING ((auth.uid() = clinician_user_id));


--
-- Name: patient_vitals Clinicians can insert vitals for assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can insert vitals for assigned patients" ON public.patient_vitals;
CREATE POLICY "Clinicians can insert vitals for assigned patients" ON public.patient_vitals FOR INSERT WITH CHECK ((public.is_clinician_assigned(user_id, auth.uid()) AND (recorded_by = auth.uid())));


--
-- Name: lab_results Clinicians can manage labs for assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can manage labs for assigned patients" ON public.lab_results;
CREATE POLICY "Clinicians can manage labs for assigned patients" ON public.lab_results USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: post_call_summaries Clinicians can manage summaries; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can manage summaries" ON public.post_call_summaries;
CREATE POLICY "Clinicians can manage summaries" ON public.post_call_summaries USING ((auth.uid() = clinician_user_id));


--
-- Name: video_call_notes Clinicians can manage their call notes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can manage their call notes" ON public.video_call_notes;
CREATE POLICY "Clinicians can manage their call notes" ON public.video_call_notes USING ((auth.uid() = clinician_user_id));


--
-- Name: waiting_room_queue Clinicians can manage their queue; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can manage their queue" ON public.waiting_room_queue;
CREATE POLICY "Clinicians can manage their queue" ON public.waiting_room_queue USING ((auth.uid() = clinician_user_id));


--
-- Name: clinician_messages Clinicians can mark patient messages as read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can mark patient messages as read" ON public.clinician_messages;
CREATE POLICY "Clinicians can mark patient messages as read" ON public.clinician_messages FOR UPDATE USING (((auth.uid() = clinician_user_id) AND (sender_type = 'patient'::text))) WITH CHECK (((auth.uid() = clinician_user_id) AND (sender_type = 'patient'::text)));


--
-- Name: clinician_messages Clinicians can send messages to assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can send messages to assigned patients" ON public.clinician_messages;
CREATE POLICY "Clinicians can send messages to assigned patients" ON public.clinician_messages FOR INSERT WITH CHECK (((auth.uid() = clinician_user_id) AND (sender_type = 'clinician'::text) AND public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: red_flag_alerts Clinicians can update alerts they can see; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update alerts they can see" ON public.red_flag_alerts;
CREATE POLICY "Clinicians can update alerts they can see" ON public.red_flag_alerts FOR UPDATE USING (((auth.uid() = clinician_user_id) OR public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: video_room_participants Clinicians can update participant status; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update participant status" ON public.video_room_participants;
CREATE POLICY "Clinicians can update participant status" ON public.video_room_participants FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.video_rooms
  WHERE ((video_rooms.id = video_room_participants.room_id) AND (video_rooms.clinician_user_id = auth.uid())))));


--
-- Name: polypharmacy_warnings Clinicians can update polypharmacy warnings; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update polypharmacy warnings" ON public.polypharmacy_warnings;
CREATE POLICY "Clinicians can update polypharmacy warnings" ON public.polypharmacy_warnings FOR UPDATE USING (public.is_clinician_assigned(patient_user_id, auth.uid()));


--
-- Name: patient_risk_flags Clinicians can update risk flags they can see; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update risk flags they can see" ON public.patient_risk_flags;
CREATE POLICY "Clinicians can update risk flags they can see" ON public.patient_risk_flags FOR UPDATE USING (((auth.uid() = clinician_user_id) OR public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: appointments Clinicians can update their appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update their appointments" ON public.appointments;
CREATE POLICY "Clinicians can update their appointments" ON public.appointments FOR UPDATE USING ((auth.uid() = clinician_user_id)) WITH CHECK ((auth.uid() = clinician_user_id));


--
-- Name: soap_notes Clinicians can update their own notes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update their own notes" ON public.soap_notes;
CREATE POLICY "Clinicians can update their own notes" ON public.soap_notes FOR UPDATE USING ((auth.uid() = clinician_user_id)) WITH CHECK ((auth.uid() = clinician_user_id));


--
-- Name: prescriptions Clinicians can update their own prescriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update their own prescriptions" ON public.prescriptions;
CREATE POLICY "Clinicians can update their own prescriptions" ON public.prescriptions FOR UPDATE USING (((auth.uid() = clinician_user_id) AND public.is_clinician(auth.uid()))) WITH CHECK ((auth.uid() = clinician_user_id));


--
-- Name: video_rooms Clinicians can update their video rooms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can update their video rooms" ON public.video_rooms;
CREATE POLICY "Clinicians can update their video rooms" ON public.video_rooms FOR UPDATE USING ((auth.uid() = clinician_user_id));


--
-- Name: red_flag_alerts Clinicians can view alerts for their patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view alerts for their patients" ON public.red_flag_alerts;
CREATE POLICY "Clinicians can view alerts for their patients" ON public.red_flag_alerts FOR SELECT USING (((auth.uid() = clinician_user_id) OR public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: profiles Clinicians can view all patient profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view all patient profiles" ON public.profiles;
CREATE POLICY "Clinicians can view all patient profiles" ON public.profiles FOR SELECT USING ((public.is_clinician(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = profiles.user_id) AND (user_roles.role = 'patient'::public.app_role))))));


--
-- Name: patient_activity_log Clinicians can view assigned patient activity; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient activity" ON public.patient_activity_log;
CREATE POLICY "Clinicians can view assigned patient activity" ON public.patient_activity_log FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: vitals_alerts Clinicians can view assigned patient alerts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient alerts" ON public.vitals_alerts;
CREATE POLICY "Clinicians can view assigned patient alerts" ON public.vitals_alerts FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: patient_allergies Clinicians can view assigned patient allergies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient allergies" ON public.patient_allergies;
CREATE POLICY "Clinicians can view assigned patient allergies" ON public.patient_allergies FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: patient_chronic_conditions Clinicians can view assigned patient conditions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient conditions" ON public.patient_chronic_conditions;
CREATE POLICY "Clinicians can view assigned patient conditions" ON public.patient_chronic_conditions FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: patient_emergency_contacts Clinicians can view assigned patient emergency contacts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient emergency contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Clinicians can view assigned patient emergency contacts" ON public.patient_emergency_contacts FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: lab_results Clinicians can view assigned patient labs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient labs" ON public.lab_results;
CREATE POLICY "Clinicians can view assigned patient labs" ON public.lab_results FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: medication_logs Clinicians can view assigned patient logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient logs" ON public.medication_logs;
CREATE POLICY "Clinicians can view assigned patient logs" ON public.medication_logs FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: medications Clinicians can view assigned patient medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient medications" ON public.medications;
CREATE POLICY "Clinicians can view assigned patient medications" ON public.medications FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: profiles Clinicians can view assigned patient profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient profiles" ON public.profiles;
CREATE POLICY "Clinicians can view assigned patient profiles" ON public.profiles FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: medication_schedules Clinicians can view assigned patient schedules; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient schedules" ON public.medication_schedules;
CREATE POLICY "Clinicians can view assigned patient schedules" ON public.medication_schedules FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: patient_engagement_scores Clinicians can view assigned patient scores; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient scores" ON public.patient_engagement_scores;
CREATE POLICY "Clinicians can view assigned patient scores" ON public.patient_engagement_scores FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: symptom_entries Clinicians can view assigned patient symptoms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient symptoms" ON public.symptom_entries;
CREATE POLICY "Clinicians can view assigned patient symptoms" ON public.symptom_entries FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: patient_vitals Clinicians can view assigned patient vitals; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view assigned patient vitals" ON public.patient_vitals;
CREATE POLICY "Clinicians can view assigned patient vitals" ON public.patient_vitals FOR SELECT USING (public.is_clinician_assigned(user_id, auth.uid()));


--
-- Name: clinician_patient_assignments Clinicians can view own assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view own assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Clinicians can view own assignments" ON public.clinician_patient_assignments FOR SELECT USING ((auth.uid() = clinician_user_id));


--
-- Name: user_roles Clinicians can view patient roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view patient roles" ON public.user_roles;
CREATE POLICY "Clinicians can view patient roles" ON public.user_roles FOR SELECT USING ((public.is_clinician(auth.uid()) AND (role = 'patient'::public.app_role)));


--
-- Name: polypharmacy_warnings Clinicians can view polypharmacy warnings for assigned patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view polypharmacy warnings for assigned patients" ON public.polypharmacy_warnings;
CREATE POLICY "Clinicians can view polypharmacy warnings for assigned patients" ON public.polypharmacy_warnings FOR SELECT USING (public.is_clinician_assigned(patient_user_id, auth.uid()));


--
-- Name: prescriptions Clinicians can view prescriptions they wrote; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view prescriptions they wrote" ON public.prescriptions;
CREATE POLICY "Clinicians can view prescriptions they wrote" ON public.prescriptions FOR SELECT USING ((auth.uid() = clinician_user_id));


--
-- Name: patient_risk_flags Clinicians can view risk flags for their patients; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view risk flags for their patients" ON public.patient_risk_flags;
CREATE POLICY "Clinicians can view risk flags for their patients" ON public.patient_risk_flags FOR SELECT USING (((auth.uid() = clinician_user_id) OR public.is_clinician_assigned(patient_user_id, auth.uid())));


--
-- Name: appointments Clinicians can view their appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view their appointments" ON public.appointments;
CREATE POLICY "Clinicians can view their appointments" ON public.appointments FOR SELECT USING ((auth.uid() = clinician_user_id));


--
-- Name: data_access_log Clinicians can view their data access; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view their data access" ON public.data_access_log;
CREATE POLICY "Clinicians can view their data access" ON public.data_access_log FOR SELECT USING (((auth.uid() = user_id) AND public.is_clinician(auth.uid())));


--
-- Name: clinician_messages Clinicians can view their messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view their messages" ON public.clinician_messages;
CREATE POLICY "Clinicians can view their messages" ON public.clinician_messages FOR SELECT USING ((auth.uid() = clinician_user_id));


--
-- Name: soap_notes Clinicians can view their own notes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view their own notes" ON public.soap_notes;
CREATE POLICY "Clinicians can view their own notes" ON public.soap_notes FOR SELECT USING ((auth.uid() = clinician_user_id));


--
-- Name: video_rooms Clinicians can view their video rooms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Clinicians can view their video rooms" ON public.video_rooms;
CREATE POLICY "Clinicians can view their video rooms" ON public.video_rooms FOR SELECT USING ((auth.uid() = clinician_user_id));


--
-- Name: medication_availability Everyone can view available medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Everyone can view available medications" ON public.medication_availability;
CREATE POLICY "Everyone can view available medications" ON public.medication_availability FOR SELECT USING ((is_available = true));


--
-- Name: user_roles Managers can delete org user roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can delete org user roles" ON public.user_roles;
CREATE POLICY "Managers can delete org user roles" ON public.user_roles FOR DELETE USING ((public.manager_can_access_user(auth.uid(), user_id) AND (role <> ALL (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));


--
-- Name: user_roles Managers can insert org user roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can insert org user roles" ON public.user_roles;
CREATE POLICY "Managers can insert org user roles" ON public.user_roles FOR INSERT WITH CHECK ((public.manager_can_access_user(auth.uid(), user_id) AND (role <> ALL (ARRAY['admin'::public.app_role, 'manager'::public.app_role]))));


--
-- Name: organization_members Managers can manage org members; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can manage org members" ON public.organization_members;
CREATE POLICY "Managers can manage org members" ON public.organization_members USING (public.is_manager_for_org(auth.uid(), organization_id));


--
-- Name: organization_branding Managers can update org branding; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can update org branding" ON public.organization_branding;
CREATE POLICY "Managers can update org branding" ON public.organization_branding FOR UPDATE USING ((public.is_manager(auth.uid()) AND (organization_id = public.get_user_organization_id(auth.uid()))));


--
-- Name: profiles Managers can update org profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can update org profiles" ON public.profiles;
CREATE POLICY "Managers can update org profiles" ON public.profiles FOR UPDATE USING (public.manager_can_access_user(auth.uid(), user_id));


--
-- Name: organizations Managers can update own organization; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can update own organization" ON public.organizations;
CREATE POLICY "Managers can update own organization" ON public.organizations FOR UPDATE USING ((public.is_manager(auth.uid()) AND (id = public.get_user_organization_id(auth.uid()))));


--
-- Name: appointments Managers can view org appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view org appointments" ON public.appointments;
CREATE POLICY "Managers can view org appointments" ON public.appointments FOR SELECT USING ((public.manager_can_access_user(auth.uid(), patient_user_id) OR public.manager_can_access_user(auth.uid(), clinician_user_id)));


--
-- Name: audit_log Managers can view org audit logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view org audit logs" ON public.audit_log;
CREATE POLICY "Managers can view org audit logs" ON public.audit_log FOR SELECT USING (public.manager_can_access_user(auth.uid(), user_id));


--
-- Name: organization_branding Managers can view org branding; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view org branding" ON public.organization_branding;
CREATE POLICY "Managers can view org branding" ON public.organization_branding FOR SELECT USING ((public.is_manager(auth.uid()) AND (organization_id = public.get_user_organization_id(auth.uid()))));


--
-- Name: medications Managers can view org medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view org medications" ON public.medications;
CREATE POLICY "Managers can view org medications" ON public.medications FOR SELECT USING (public.manager_can_access_user(auth.uid(), user_id));


--
-- Name: profiles Managers can view org profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view org profiles" ON public.profiles;
CREATE POLICY "Managers can view org profiles" ON public.profiles FOR SELECT USING (public.manager_can_access_user(auth.uid(), user_id));


--
-- Name: user_roles Managers can view org user roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view org user roles" ON public.user_roles;
CREATE POLICY "Managers can view org user roles" ON public.user_roles FOR SELECT USING (public.manager_can_access_user(auth.uid(), user_id));


--
-- Name: organizations Managers can view own organization; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Managers can view own organization" ON public.organizations;
CREATE POLICY "Managers can view own organization" ON public.organizations FOR SELECT USING ((public.is_manager(auth.uid()) AND (id = public.get_user_organization_id(auth.uid()))));


--
-- Name: organization_branding Members can view org branding; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Members can view org branding" ON public.organization_branding;
CREATE POLICY "Members can view org branding" ON public.organization_branding FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));


--
-- Name: organizations Members can view their organization; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization" ON public.organizations FOR SELECT USING (public.user_belongs_to_org(auth.uid(), id));


--
-- Name: login_attempts No direct inserts allowed; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "No direct inserts allowed" ON public.login_attempts;
CREATE POLICY "No direct inserts allowed" ON public.login_attempts FOR INSERT WITH CHECK (false);


--
-- Name: account_lockouts No direct lockout deletes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "No direct lockout deletes" ON public.account_lockouts;
CREATE POLICY "No direct lockout deletes" ON public.account_lockouts FOR DELETE USING (false);


--
-- Name: account_lockouts No direct lockout modifications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "No direct lockout modifications" ON public.account_lockouts;
CREATE POLICY "No direct lockout modifications" ON public.account_lockouts FOR INSERT WITH CHECK (false);


--
-- Name: account_lockouts No direct lockout updates; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "No direct lockout updates" ON public.account_lockouts;
CREATE POLICY "No direct lockout updates" ON public.account_lockouts FOR UPDATE USING (false);


--
-- Name: billing_events Only platform admins can create billing events; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Only platform admins can create billing events" ON public.billing_events;
CREATE POLICY "Only platform admins can create billing events" ON public.billing_events FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: organization_invoices Only platform admins can modify invoices; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Only platform admins can modify invoices" ON public.organization_invoices;
CREATE POLICY "Only platform admins can modify invoices" ON public.organization_invoices USING (public.is_admin(auth.uid()));


--
-- Name: organization_payment_methods Only platform admins can modify payment methods; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Only platform admins can modify payment methods" ON public.organization_payment_methods;
CREATE POLICY "Only platform admins can modify payment methods" ON public.organization_payment_methods USING (public.is_admin(auth.uid()));


--
-- Name: organization_subscriptions Only platform admins can modify subscriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Only platform admins can modify subscriptions" ON public.organization_subscriptions;
CREATE POLICY "Only platform admins can modify subscriptions" ON public.organization_subscriptions USING (public.is_admin(auth.uid()));


--
-- Name: organization_branding Org admins can manage branding; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Org admins can manage branding" ON public.organization_branding;
CREATE POLICY "Org admins can manage branding" ON public.organization_branding USING (public.is_org_admin_for(auth.uid(), organization_id));


--
-- Name: billing_events Org admins can view their billing events; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Org admins can view their billing events" ON public.billing_events;
CREATE POLICY "Org admins can view their billing events" ON public.billing_events FOR SELECT USING ((public.is_admin(auth.uid()) OR public.is_org_admin_for(auth.uid(), organization_id) OR public.is_manager_for_org(auth.uid(), organization_id)));


--
-- Name: organization_invoices Org admins can view their invoices; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Org admins can view their invoices" ON public.organization_invoices;
CREATE POLICY "Org admins can view their invoices" ON public.organization_invoices FOR SELECT USING ((public.is_admin(auth.uid()) OR public.is_org_admin_for(auth.uid(), organization_id) OR public.is_manager_for_org(auth.uid(), organization_id)));


--
-- Name: organization_payment_methods Org admins can view their payment methods; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Org admins can view their payment methods" ON public.organization_payment_methods;
CREATE POLICY "Org admins can view their payment methods" ON public.organization_payment_methods FOR SELECT USING ((public.is_admin(auth.uid()) OR public.is_org_admin_for(auth.uid(), organization_id)));


--
-- Name: organization_subscriptions Org admins can view their subscription; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Org admins can view their subscription" ON public.organization_subscriptions;
CREATE POLICY "Org admins can view their subscription" ON public.organization_subscriptions FOR SELECT USING ((public.is_admin(auth.uid()) OR public.is_org_admin_for(auth.uid(), organization_id) OR public.is_manager_for_org(auth.uid(), organization_id)));


--
-- Name: organizations Org owners can update their organization; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Org owners can update their organization" ON public.organizations;
CREATE POLICY "Org owners can update their organization" ON public.organizations FOR UPDATE USING (public.is_org_admin_for(auth.uid(), id));


--
-- Name: appointments Patients can confirm or cancel their appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can confirm or cancel their appointments" ON public.appointments;
CREATE POLICY "Patients can confirm or cancel their appointments" ON public.appointments FOR UPDATE USING ((auth.uid() = patient_user_id)) WITH CHECK (((auth.uid() = patient_user_id) AND (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text]))));


--
-- Name: caregiver_invitations Patients can create caregiver invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can create caregiver invitations" ON public.caregiver_invitations;
CREATE POLICY "Patients can create caregiver invitations" ON public.caregiver_invitations FOR INSERT WITH CHECK ((public.is_patient(auth.uid()) AND (auth.uid() = patient_user_id)));


--
-- Name: refill_requests Patients can create refill requests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can create refill requests" ON public.refill_requests;
CREATE POLICY "Patients can create refill requests" ON public.refill_requests FOR INSERT WITH CHECK (((auth.uid() = patient_user_id) AND (EXISTS ( SELECT 1
   FROM public.medications
  WHERE ((medications.id = refill_requests.medication_id) AND (medications.user_id = auth.uid()))))));


--
-- Name: caregiver_invitations Patients can delete own invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can delete own invitations" ON public.caregiver_invitations;
CREATE POLICY "Patients can delete own invitations" ON public.caregiver_invitations FOR DELETE USING ((auth.uid() = patient_user_id));


--
-- Name: patient_vitals Patients can delete own vitals; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can delete own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can delete own vitals" ON public.patient_vitals FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: patient_vitals Patients can insert own vitals; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can insert own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can insert own vitals" ON public.patient_vitals FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: waiting_room_queue Patients can join queue; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can join queue" ON public.waiting_room_queue;
CREATE POLICY "Patients can join queue" ON public.waiting_room_queue FOR INSERT WITH CHECK ((auth.uid() = patient_user_id));


--
-- Name: medication_availability_alerts Patients can manage their availability alerts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can manage their availability alerts" ON public.medication_availability_alerts;
CREATE POLICY "Patients can manage their availability alerts" ON public.medication_availability_alerts USING ((public.is_patient(auth.uid()) AND (auth.uid() = patient_user_id)));


--
-- Name: patient_preferred_pharmacies Patients can manage their preferred pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can manage their preferred pharmacies" ON public.patient_preferred_pharmacies;
CREATE POLICY "Patients can manage their preferred pharmacies" ON public.patient_preferred_pharmacies USING ((public.is_patient(auth.uid()) AND (auth.uid() = patient_user_id)));


--
-- Name: clinician_messages Patients can mark clinician messages as read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can mark clinician messages as read" ON public.clinician_messages;
CREATE POLICY "Patients can mark clinician messages as read" ON public.clinician_messages FOR UPDATE USING (((auth.uid() = patient_user_id) AND (sender_type = 'clinician'::text))) WITH CHECK (((auth.uid() = patient_user_id) AND (sender_type = 'clinician'::text)));


--
-- Name: caregiver_messages Patients can mark messages as read; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can mark messages as read" ON public.caregiver_messages;
CREATE POLICY "Patients can mark messages as read" ON public.caregiver_messages FOR UPDATE USING ((auth.uid() = patient_user_id)) WITH CHECK ((auth.uid() = patient_user_id));


--
-- Name: clinician_messages Patients can reply to their clinicians; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can reply to their clinicians" ON public.clinician_messages;
CREATE POLICY "Patients can reply to their clinicians" ON public.clinician_messages FOR INSERT WITH CHECK (((auth.uid() = patient_user_id) AND (sender_type = 'patient'::text) AND public.is_clinician_assigned(patient_user_id, clinician_user_id)));


--
-- Name: caregiver_messages Patients can send replies to their caregivers; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can send replies to their caregivers" ON public.caregiver_messages;
CREATE POLICY "Patients can send replies to their caregivers" ON public.caregiver_messages FOR INSERT WITH CHECK (((auth.uid() = patient_user_id) AND (sender_type = 'patient'::text) AND public.is_caregiver_for_patient(patient_user_id, caregiver_user_id)));


--
-- Name: caregiver_invitations Patients can update own invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can update own invitations" ON public.caregiver_invitations;
CREATE POLICY "Patients can update own invitations" ON public.caregiver_invitations FOR UPDATE USING ((auth.uid() = patient_user_id)) WITH CHECK ((auth.uid() = patient_user_id));


--
-- Name: patient_vitals Patients can update own vitals; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can update own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can update own vitals" ON public.patient_vitals FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: pharmacy_locations Patients can view active pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view active pharmacies" ON public.pharmacy_locations;
CREATE POLICY "Patients can view active pharmacies" ON public.pharmacy_locations FOR SELECT USING (((is_active = true) AND (public.is_patient(auth.uid()) OR public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid()) OR public.is_clinician(auth.uid()))));


--
-- Name: video_call_notes Patients can view finalized notes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view finalized notes" ON public.video_call_notes;
CREATE POLICY "Patients can view finalized notes" ON public.video_call_notes FOR SELECT USING (((auth.uid() = patient_user_id) AND (is_draft = false)));


--
-- Name: caregiver_invitations Patients can view own caregiver invitations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view own caregiver invitations" ON public.caregiver_invitations;
CREATE POLICY "Patients can view own caregiver invitations" ON public.caregiver_invitations FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: lab_results Patients can view own lab results; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view own lab results" ON public.lab_results;
CREATE POLICY "Patients can view own lab results" ON public.lab_results FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: refill_requests Patients can view own refill requests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view own refill requests" ON public.refill_requests;
CREATE POLICY "Patients can view own refill requests" ON public.refill_requests FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: patient_vitals Patients can view own vitals; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can view own vitals" ON public.patient_vitals FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: vitals_alerts Patients can view own vitals alerts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view own vitals alerts" ON public.vitals_alerts;
CREATE POLICY "Patients can view own vitals alerts" ON public.vitals_alerts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: appointments Patients can view their appointments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their appointments" ON public.appointments;
CREATE POLICY "Patients can view their appointments" ON public.appointments FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: clinician_patient_assignments Patients can view their assignments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their assignments" ON public.clinician_patient_assignments;
CREATE POLICY "Patients can view their assignments" ON public.clinician_patient_assignments FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: clinician_messages Patients can view their messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their messages" ON public.clinician_messages;
CREATE POLICY "Patients can view their messages" ON public.clinician_messages FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: availability_notification_history Patients can view their notification history; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their notification history" ON public.availability_notification_history;
CREATE POLICY "Patients can view their notification history" ON public.availability_notification_history FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: red_flag_alerts Patients can view their own alerts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their own alerts" ON public.red_flag_alerts;
CREATE POLICY "Patients can view their own alerts" ON public.red_flag_alerts FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: prescriptions Patients can view their own prescriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their own prescriptions" ON public.prescriptions;
CREATE POLICY "Patients can view their own prescriptions" ON public.prescriptions FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: waiting_room_queue Patients can view their queue position; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their queue position" ON public.waiting_room_queue;
CREATE POLICY "Patients can view their queue position" ON public.waiting_room_queue FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: caregiver_messages Patients can view their received messages; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their received messages" ON public.caregiver_messages;
CREATE POLICY "Patients can view their received messages" ON public.caregiver_messages FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: post_call_summaries Patients can view their summaries; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their summaries" ON public.post_call_summaries;
CREATE POLICY "Patients can view their summaries" ON public.post_call_summaries FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: video_rooms Patients can view their video rooms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Patients can view their video rooms" ON public.video_rooms;
CREATE POLICY "Patients can view their video rooms" ON public.video_rooms FOR SELECT USING ((auth.uid() = patient_user_id));


--
-- Name: drug_recalls Pharmacists and admins can create recalls; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists and admins can create recalls" ON public.drug_recalls;
CREATE POLICY "Pharmacists and admins can create recalls" ON public.drug_recalls FOR INSERT WITH CHECK ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: medication_catalog Pharmacists and admins can manage medication catalog; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists and admins can manage medication catalog" ON public.medication_catalog;
CREATE POLICY "Pharmacists and admins can manage medication catalog" ON public.medication_catalog USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: drug_recalls Pharmacists and admins can update recalls; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists and admins can update recalls" ON public.drug_recalls;
CREATE POLICY "Pharmacists and admins can update recalls" ON public.drug_recalls FOR UPDATE USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: drug_recalls Pharmacists and admins can view all recalls; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists and admins can view all recalls" ON public.drug_recalls;
CREATE POLICY "Pharmacists and admins can view all recalls" ON public.drug_recalls FOR SELECT USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: drug_recall_notifications Pharmacists can acknowledge notifications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can acknowledge notifications" ON public.drug_recall_notifications;
CREATE POLICY "Pharmacists can acknowledge notifications" ON public.drug_recall_notifications FOR UPDATE USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: controlled_drug_adjustments Pharmacists can create adjustments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can create adjustments" ON public.controlled_drug_adjustments;
CREATE POLICY "Pharmacists can create adjustments" ON public.controlled_drug_adjustments FOR INSERT WITH CHECK ((public.is_pharmacist(auth.uid()) AND (auth.uid() = performed_by)));


--
-- Name: controlled_drugs Pharmacists can create controlled drugs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can create controlled drugs" ON public.controlled_drugs;
CREATE POLICY "Pharmacists can create controlled drugs" ON public.controlled_drugs FOR INSERT WITH CHECK (public.is_pharmacist(auth.uid()));


--
-- Name: controlled_drug_dispensing Pharmacists can create dispensing records; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can create dispensing records" ON public.controlled_drug_dispensing;
CREATE POLICY "Pharmacists can create dispensing records" ON public.controlled_drug_dispensing FOR INSERT WITH CHECK ((public.is_pharmacist(auth.uid()) AND (auth.uid() = dispensing_pharmacist_id)));


--
-- Name: drug_transfers Pharmacists can create transfer requests from their pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can create transfer requests from their pharmacies" ON public.drug_transfers;
CREATE POLICY "Pharmacists can create transfer requests from their pharmacies" ON public.drug_transfers FOR INSERT WITH CHECK ((public.is_pharmacist(auth.uid()) AND (auth.uid() = requested_by) AND (EXISTS ( SELECT 1
   FROM public.pharmacy_locations
  WHERE ((pharmacy_locations.id = drug_transfers.source_pharmacy_id) AND (pharmacy_locations.pharmacist_user_id = auth.uid()))))));


--
-- Name: medication_availability Pharmacists can manage availability at their pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can manage availability at their pharmacies" ON public.medication_availability;
CREATE POLICY "Pharmacists can manage availability at their pharmacies" ON public.medication_availability USING ((public.is_pharmacist(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.pharmacy_locations
  WHERE ((pharmacy_locations.id = medication_availability.pharmacy_id) AND (pharmacy_locations.pharmacist_user_id = auth.uid()))))));


--
-- Name: pharmacy_locations Pharmacists can manage their pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can manage their pharmacies" ON public.pharmacy_locations;
CREATE POLICY "Pharmacists can manage their pharmacies" ON public.pharmacy_locations USING ((public.is_pharmacist(auth.uid()) AND (auth.uid() = pharmacist_user_id)));


--
-- Name: pharmacy_locations Pharmacists can manage their pharmacy locations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can manage their pharmacy locations" ON public.pharmacy_locations;
CREATE POLICY "Pharmacists can manage their pharmacy locations" ON public.pharmacy_locations USING (((pharmacist_user_id = auth.uid()) OR public.is_admin(auth.uid()))) WITH CHECK (((pharmacist_user_id = auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: controlled_drugs Pharmacists can update controlled drugs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can update controlled drugs" ON public.controlled_drugs;
CREATE POLICY "Pharmacists can update controlled drugs" ON public.controlled_drugs FOR UPDATE USING (public.is_pharmacist(auth.uid()));


--
-- Name: medications Pharmacists can update prescription status; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can update prescription status" ON public.medications;
CREATE POLICY "Pharmacists can update prescription status" ON public.medications FOR UPDATE USING (public.is_pharmacist(auth.uid())) WITH CHECK (public.is_pharmacist(auth.uid()));


--
-- Name: prescriptions Pharmacists can update prescription status; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can update prescription status" ON public.prescriptions;
CREATE POLICY "Pharmacists can update prescription status" ON public.prescriptions FOR UPDATE USING ((public.is_pharmacist(auth.uid()) AND (pharmacy_id IN ( SELECT pharmacy_locations.id
   FROM public.pharmacy_locations
  WHERE (pharmacy_locations.pharmacist_user_id = auth.uid())))));


--
-- Name: refill_requests Pharmacists can update refill requests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can update refill requests" ON public.refill_requests;
CREATE POLICY "Pharmacists can update refill requests" ON public.refill_requests FOR UPDATE USING (public.is_pharmacist(auth.uid()));


--
-- Name: drug_transfers Pharmacists can update transfers for their pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can update transfers for their pharmacies" ON public.drug_transfers;
CREATE POLICY "Pharmacists can update transfers for their pharmacies" ON public.drug_transfers FOR UPDATE USING ((public.is_pharmacist(auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.pharmacy_locations
  WHERE ((pharmacy_locations.id = drug_transfers.source_pharmacy_id) AND (pharmacy_locations.pharmacist_user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.pharmacy_locations
  WHERE ((pharmacy_locations.id = drug_transfers.destination_pharmacy_id) AND (pharmacy_locations.pharmacist_user_id = auth.uid())))))));


--
-- Name: controlled_drug_adjustments Pharmacists can view all adjustments; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view all adjustments" ON public.controlled_drug_adjustments;
CREATE POLICY "Pharmacists can view all adjustments" ON public.controlled_drug_adjustments FOR SELECT USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: controlled_drugs Pharmacists can view all controlled drugs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view all controlled drugs" ON public.controlled_drugs;
CREATE POLICY "Pharmacists can view all controlled drugs" ON public.controlled_drugs FOR SELECT USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: controlled_drug_dispensing Pharmacists can view all dispensing records; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view all dispensing records" ON public.controlled_drug_dispensing;
CREATE POLICY "Pharmacists can view all dispensing records" ON public.controlled_drug_dispensing FOR SELECT USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid())));


--
-- Name: medications Pharmacists can view all prescriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view all prescriptions" ON public.medications;
CREATE POLICY "Pharmacists can view all prescriptions" ON public.medications FOR SELECT USING (public.is_pharmacist(auth.uid()));


--
-- Name: refill_requests Pharmacists can view all refill requests; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view all refill requests" ON public.refill_requests;
CREATE POLICY "Pharmacists can view all refill requests" ON public.refill_requests FOR SELECT USING (public.is_pharmacist(auth.uid()));


--
-- Name: prescription_status_history Pharmacists can view history of their prescriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view history of their prescriptions" ON public.prescription_status_history;
CREATE POLICY "Pharmacists can view history of their prescriptions" ON public.prescription_status_history FOR SELECT USING ((public.is_pharmacist(auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.prescriptions p
  WHERE ((p.id = prescription_status_history.prescription_id) AND (p.pharmacy_id IN ( SELECT pharmacy_locations.id
           FROM public.pharmacy_locations
          WHERE (pharmacy_locations.pharmacist_user_id = auth.uid()))))))));


--
-- Name: drug_recall_notifications Pharmacists can view pharmacy notifications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view pharmacy notifications" ON public.drug_recall_notifications;
CREATE POLICY "Pharmacists can view pharmacy notifications" ON public.drug_recall_notifications FOR SELECT USING ((public.is_pharmacist(auth.uid()) OR public.is_admin(auth.uid()) OR (auth.uid() = patient_user_id)));


--
-- Name: profiles Pharmacists can view prescription patient profiles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view prescription patient profiles" ON public.profiles;
CREATE POLICY "Pharmacists can view prescription patient profiles" ON public.profiles FOR SELECT USING ((public.is_pharmacist(auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.prescriptions p
     JOIN public.pharmacy_locations pl ON ((pl.id = p.pharmacy_id)))
  WHERE ((pl.pharmacist_user_id = auth.uid()) AND ((p.patient_user_id = profiles.user_id) OR (p.clinician_user_id = profiles.user_id)))))));


--
-- Name: prescriptions Pharmacists can view prescriptions for their pharmacy; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view prescriptions for their pharmacy" ON public.prescriptions;
CREATE POLICY "Pharmacists can view prescriptions for their pharmacy" ON public.prescriptions FOR SELECT USING ((public.is_pharmacist(auth.uid()) AND (pharmacy_id IN ( SELECT pharmacy_locations.id
   FROM public.pharmacy_locations
  WHERE (pharmacy_locations.pharmacist_user_id = auth.uid())))));


--
-- Name: drug_transfers Pharmacists can view transfers for their pharmacies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Pharmacists can view transfers for their pharmacies" ON public.drug_transfers;
CREATE POLICY "Pharmacists can view transfers for their pharmacies" ON public.drug_transfers FOR SELECT USING ((public.is_pharmacist(auth.uid()) AND ((EXISTS ( SELECT 1
   FROM public.pharmacy_locations
  WHERE ((pharmacy_locations.id = drug_transfers.source_pharmacy_id) AND (pharmacy_locations.pharmacist_user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.pharmacy_locations
  WHERE ((pharmacy_locations.id = drug_transfers.destination_pharmacy_id) AND (pharmacy_locations.pharmacist_user_id = auth.uid())))))));


--
-- Name: organization_branding Platform admins can manage all branding; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Platform admins can manage all branding" ON public.organization_branding;
CREATE POLICY "Platform admins can manage all branding" ON public.organization_branding USING (public.is_admin(auth.uid()));


--
-- Name: organization_members Platform admins can manage all members; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Platform admins can manage all members" ON public.organization_members;
CREATE POLICY "Platform admins can manage all members" ON public.organization_members USING (public.is_admin(auth.uid()));


--
-- Name: organizations Platform admins can manage organizations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Platform admins can manage organizations" ON public.organizations;
CREATE POLICY "Platform admins can manage organizations" ON public.organizations USING (public.is_admin(auth.uid()));


--
-- Name: organizations Platform admins can view all organizations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
CREATE POLICY "Platform admins can view all organizations" ON public.organizations FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: video_room_participants Room participants can view participants; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Room participants can view participants" ON public.video_room_participants;
CREATE POLICY "Room participants can view participants" ON public.video_room_participants FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.video_rooms
  WHERE ((video_rooms.id = video_room_participants.room_id) AND ((video_rooms.clinician_user_id = auth.uid()) OR (video_rooms.patient_user_id = auth.uid()))))));


--
-- Name: patient_allergies Users can delete own allergies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own allergies" ON public.patient_allergies;
CREATE POLICY "Users can delete own allergies" ON public.patient_allergies FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: patient_chronic_conditions Users can delete own chronic conditions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own chronic conditions" ON public.patient_chronic_conditions;
CREATE POLICY "Users can delete own chronic conditions" ON public.patient_chronic_conditions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: patient_emergency_contacts Users can delete own emergency contacts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own emergency contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Users can delete own emergency contacts" ON public.patient_emergency_contacts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: medications Users can delete own medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
CREATE POLICY "Users can delete own medications" ON public.medications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can delete own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: mfa_recovery_codes Users can delete own recovery codes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can delete own recovery codes" ON public.mfa_recovery_codes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: medication_schedules Users can delete own schedules; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own schedules" ON public.medication_schedules;
CREATE POLICY "Users can delete own schedules" ON public.medication_schedules FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: symptom_entries Users can delete own symptoms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can delete own symptoms" ON public.symptom_entries FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can delete own trusted devices; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can delete own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can delete own trusted devices" ON public.trusted_devices FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: patient_activity_log Users can insert own activity; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own activity" ON public.patient_activity_log;
CREATE POLICY "Users can insert own activity" ON public.patient_activity_log FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: patient_allergies Users can insert own allergies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own allergies" ON public.patient_allergies;
CREATE POLICY "Users can insert own allergies" ON public.patient_allergies FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: patient_chronic_conditions Users can insert own chronic conditions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own chronic conditions" ON public.patient_chronic_conditions;
CREATE POLICY "Users can insert own chronic conditions" ON public.patient_chronic_conditions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: patient_emergency_contacts Users can insert own emergency contacts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own emergency contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Users can insert own emergency contacts" ON public.patient_emergency_contacts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: medication_logs Users can insert own logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own logs" ON public.medication_logs;
CREATE POLICY "Users can insert own logs" ON public.medication_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: medications Users can insert own medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
CREATE POLICY "Users can insert own medications" ON public.medications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: patient_notification_preferences Users can insert own notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Users can insert own notification preferences" ON public.patient_notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can insert own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: mfa_recovery_codes Users can insert own recovery codes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can insert own recovery codes" ON public.mfa_recovery_codes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: medication_schedules Users can insert own schedules; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own schedules" ON public.medication_schedules;
CREATE POLICY "Users can insert own schedules" ON public.medication_schedules FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: security_notification_preferences Users can insert own security notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own security notification preferences" ON public.security_notification_preferences;
CREATE POLICY "Users can insert own security notification preferences" ON public.security_notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: symptom_entries Users can insert own symptoms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can insert own symptoms" ON public.symptom_entries FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can insert own trusted devices; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can insert own trusted devices" ON public.trusted_devices FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: video_room_participants Users can insert themselves as participants; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can insert themselves as participants" ON public.video_room_participants;
CREATE POLICY "Users can insert themselves as participants" ON public.video_room_participants FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: patient_allergies Users can update own allergies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own allergies" ON public.patient_allergies;
CREATE POLICY "Users can update own allergies" ON public.patient_allergies FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: patient_chronic_conditions Users can update own chronic conditions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own chronic conditions" ON public.patient_chronic_conditions;
CREATE POLICY "Users can update own chronic conditions" ON public.patient_chronic_conditions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: patient_emergency_contacts Users can update own emergency contacts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own emergency contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Users can update own emergency contacts" ON public.patient_emergency_contacts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_login_locations Users can update own login locations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own login locations" ON public.user_login_locations;
CREATE POLICY "Users can update own login locations" ON public.user_login_locations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: medication_logs Users can update own logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own logs" ON public.medication_logs;
CREATE POLICY "Users can update own logs" ON public.medication_logs FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: medications Users can update own medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
CREATE POLICY "Users can update own medications" ON public.medications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: patient_notification_preferences Users can update own notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Users can update own notification preferences" ON public.patient_notification_preferences FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: video_room_participants Users can update own participation; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own participation" ON public.video_room_participants;
CREATE POLICY "Users can update own participation" ON public.video_room_participants FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can update own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: mfa_recovery_codes Users can update own recovery codes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can update own recovery codes" ON public.mfa_recovery_codes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: medication_schedules Users can update own schedules; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own schedules" ON public.medication_schedules;
CREATE POLICY "Users can update own schedules" ON public.medication_schedules FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: security_notification_preferences Users can update own security notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own security notification preferences" ON public.security_notification_preferences;
CREATE POLICY "Users can update own security notification preferences" ON public.security_notification_preferences FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: symptom_entries Users can update own symptoms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can update own symptoms" ON public.symptom_entries FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can update own trusted devices; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can update own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can update own trusted devices" ON public.trusted_devices FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: prescription_status_history Users can view history of their prescriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view history of their prescriptions" ON public.prescription_status_history;
CREATE POLICY "Users can view history of their prescriptions" ON public.prescription_status_history FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.prescriptions p
  WHERE ((p.id = prescription_status_history.prescription_id) AND ((p.patient_user_id = auth.uid()) OR (p.clinician_user_id = auth.uid()))))));


--
-- Name: patient_activity_log Users can view own activity; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own activity" ON public.patient_activity_log;
CREATE POLICY "Users can view own activity" ON public.patient_activity_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: patient_allergies Users can view own allergies; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own allergies" ON public.patient_allergies;
CREATE POLICY "Users can view own allergies" ON public.patient_allergies FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: audit_log Users can view own audit logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
CREATE POLICY "Users can view own audit logs" ON public.audit_log FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: patient_chronic_conditions Users can view own chronic conditions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own chronic conditions" ON public.patient_chronic_conditions;
CREATE POLICY "Users can view own chronic conditions" ON public.patient_chronic_conditions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: patient_emergency_contacts Users can view own emergency contacts; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own emergency contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Users can view own emergency contacts" ON public.patient_emergency_contacts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: patient_engagement_scores Users can view own engagement scores; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own engagement scores" ON public.patient_engagement_scores;
CREATE POLICY "Users can view own engagement scores" ON public.patient_engagement_scores FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_login_locations Users can view own login locations; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own login locations" ON public.user_login_locations;
CREATE POLICY "Users can view own login locations" ON public.user_login_locations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: medication_logs Users can view own logs; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own logs" ON public.medication_logs;
CREATE POLICY "Users can view own logs" ON public.medication_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: medications Users can view own medications; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
CREATE POLICY "Users can view own medications" ON public.medications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: organization_members Users can view own membership; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own membership" ON public.organization_members;
CREATE POLICY "Users can view own membership" ON public.organization_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notification_history Users can view own notification history; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own notification history" ON public.notification_history;
CREATE POLICY "Users can view own notification history" ON public.notification_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: patient_notification_preferences Users can view own notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Users can view own notification preferences" ON public.patient_notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions Users can view own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: mfa_recovery_codes Users can view own recovery codes; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can view own recovery codes" ON public.mfa_recovery_codes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: medication_schedules Users can view own schedules; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own schedules" ON public.medication_schedules;
CREATE POLICY "Users can view own schedules" ON public.medication_schedules FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: security_events Users can view own security events; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own security events" ON public.security_events;
CREATE POLICY "Users can view own security events" ON public.security_events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: security_notification_preferences Users can view own security notification preferences; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own security notification preferences" ON public.security_notification_preferences;
CREATE POLICY "Users can view own security notification preferences" ON public.security_notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: symptom_entries Users can view own symptoms; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can view own symptoms" ON public.symptom_entries FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: trusted_devices Users can view own trusted devices; Type: POLICY; Schema: public; Owner: -
--

DROP POLICY IF EXISTS "Users can view own trusted devices" ON public.trusted_devices;
CREATE POLICY "Users can view own trusted devices" ON public.trusted_devices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: account_lockouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: availability_notification_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.availability_notification_history ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

--
-- Name: caregiver_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caregiver_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: caregiver_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.caregiver_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: clinician_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinician_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: clinician_patient_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinician_patient_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: controlled_drug_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.controlled_drug_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: controlled_drug_dispensing; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.controlled_drug_dispensing ENABLE ROW LEVEL SECURITY;

--
-- Name: controlled_drugs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.controlled_drugs ENABLE ROW LEVEL SECURITY;

--
-- Name: data_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_recall_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drug_recall_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_recalls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drug_recalls ENABLE ROW LEVEL SECURITY;

--
-- Name: drug_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drug_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ab_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_ab_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: email_ab_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_ab_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: lab_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_availability_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_availability_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: medication_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: medications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_recovery_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_branding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_branding ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_allergies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_chronic_conditions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_chronic_conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_emergency_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_engagement_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_engagement_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_preferred_pharmacies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_preferred_pharmacies ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_risk_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_risk_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_vitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

--
-- Name: pharmacy_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pharmacy_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: polypharmacy_warnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.polypharmacy_warnings ENABLE ROW LEVEL SECURITY;

--
-- Name: post_call_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_call_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: prescription_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescription_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: red_flag_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.red_flag_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: refill_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refill_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

--
-- Name: security_notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: security_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: soap_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: symptom_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.symptom_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: trusted_devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_login_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_login_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: video_call_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_call_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: video_room_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_room_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: video_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: vitals_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vitals_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: waiting_room_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waiting_room_queue ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict qJO2qalKoasfdb70dA14FWzTc69rKqg7Hi5J3EUPnBB01v4LmAMw4E4t0IDJNUM

