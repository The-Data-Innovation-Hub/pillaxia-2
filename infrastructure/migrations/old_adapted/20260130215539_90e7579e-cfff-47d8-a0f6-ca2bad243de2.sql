-- Fix trust_device function to validate that caller is the user being trusted
-- This prevents privilege escalation where someone could trust a device for another user

CREATE OR REPLACE FUNCTION public.trust_device(
  p_user_id uuid, 
  p_device_token_hash text, 
  p_device_name text DEFAULT NULL::text, 
  p_browser text DEFAULT NULL::text, 
  p_os text DEFAULT NULL::text, 
  p_ip text DEFAULT NULL::text, 
  p_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix log_security_event to validate caller authorization
-- Users can only log events for themselves unless they are admins
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id uuid, 
  p_event_type security_event_type, 
  p_event_category text DEFAULT 'authentication'::text, 
  p_severity text DEFAULT 'info'::text, 
  p_description text DEFAULT NULL::text, 
  p_ip_address text DEFAULT NULL::text, 
  p_user_agent text DEFAULT NULL::text, 
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix log_data_access to validate caller authorization
-- Users can only log their own access unless they are admins
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_user_id uuid, 
  p_accessed_table text, 
  p_accessed_record_id uuid, 
  p_access_type text, 
  p_data_category text DEFAULT 'general'::text, 
  p_patient_id uuid DEFAULT NULL::uuid, 
  p_reason text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Add comment documenting the security model
COMMENT ON FUNCTION public.trust_device IS 'Trusts a device for MFA bypass. SECURITY: Users can only trust devices for themselves.';
COMMENT ON FUNCTION public.log_security_event IS 'Logs security events. SECURITY: Users can only log events for themselves unless admin.';
COMMENT ON FUNCTION public.log_data_access IS 'Logs data access for compliance. SECURITY: Users can only log their own access unless admin.';