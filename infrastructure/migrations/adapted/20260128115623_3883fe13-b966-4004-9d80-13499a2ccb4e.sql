-- Security Compliance Enhancement Migration
-- Adds session tracking, enhanced audit logging, and security events

-- Create security event types enum
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
  'account_unlocked'
);

-- Create user sessions table for tracking active sessions
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  location JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create security events table for comprehensive audit trail
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type security_event_type NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'authentication',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  location JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Create data access log for HIPAA/NDPR compliance
CREATE TABLE public.data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  accessed_table TEXT NOT NULL,
  accessed_record_id UUID,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'create', 'update', 'delete', 'export', 'print')),
  data_category TEXT NOT NULL DEFAULT 'general' CHECK (data_category IN ('general', 'pii', 'phi', 'financial', 'credentials')),
  patient_id UUID,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on data_access_log
ALTER TABLE public.data_access_log ENABLE ROW LEVEL SECURITY;

-- Create security settings table
CREATE TABLE public.security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security_settings
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

-- Create compliance reports table
CREATE TABLE public.compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('access_audit', 'security_audit', 'hipaa_compliance', 'ndpr_compliance', 'data_retention')),
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  generated_by UUID NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on compliance_reports
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage sessions"
  ON public.user_sessions FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for security_events
CREATE POLICY "Users can view own security events"
  ON public.security_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security events"
  ON public.security_events FOR SELECT
  USING (is_admin(auth.uid()));

-- RLS Policies for data_access_log
CREATE POLICY "Admins can view all data access logs"
  ON public.data_access_log FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Clinicians can view their data access"
  ON public.data_access_log FOR SELECT
  USING (auth.uid() = user_id AND is_clinician(auth.uid()));

-- RLS Policies for security_settings
CREATE POLICY "Admins can manage security settings"
  ON public.security_settings FOR ALL
  USING (is_admin(auth.uid()));

-- RLS Policies for compliance_reports
CREATE POLICY "Admins can manage compliance reports"
  ON public.compliance_reports FOR ALL
  USING (is_admin(auth.uid()));

-- Insert default security settings
INSERT INTO public.security_settings (setting_key, setting_value, description) VALUES
  ('session_timeout_minutes', '{"value": 30}'::jsonb, 'Session timeout in minutes of inactivity'),
  ('max_concurrent_sessions', '{"value": 3}'::jsonb, 'Maximum number of concurrent sessions per user'),
  ('failed_login_lockout_attempts', '{"value": 5}'::jsonb, 'Number of failed login attempts before account lockout'),
  ('failed_login_lockout_minutes', '{"value": 15}'::jsonb, 'Account lockout duration in minutes'),
  ('password_min_length', '{"value": 8}'::jsonb, 'Minimum password length'),
  ('password_require_special', '{"value": true}'::jsonb, 'Require special characters in password'),
  ('password_require_numbers', '{"value": true}'::jsonb, 'Require numbers in password'),
  ('password_require_uppercase', '{"value": true}'::jsonb, 'Require uppercase letters in password'),
  ('data_retention_days', '{"value": 2555}'::jsonb, 'Data retention period in days (7 years for HIPAA)'),
  ('audit_log_retention_days', '{"value": 2555}'::jsonb, 'Audit log retention period in days'),
  ('phi_access_logging', '{"value": true}'::jsonb, 'Enable PHI access logging for HIPAA compliance'),
  ('require_mfa_for_admin', '{"value": true}'::jsonb, 'Require MFA for admin accounts'),
  ('require_mfa_for_clinician', '{"value": false}'::jsonb, 'Require MFA for clinician accounts');

-- Create indexes for performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_is_active ON public.user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_data_access_log_user_id ON public.data_access_log(user_id);
CREATE INDEX idx_data_access_log_patient_id ON public.data_access_log(patient_id);
CREATE INDEX idx_data_access_log_created_at ON public.data_access_log(created_at);
CREATE INDEX idx_data_access_log_data_category ON public.data_access_log(data_category);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id UUID,
  p_event_type security_event_type,
  p_event_category TEXT DEFAULT 'authentication',
  p_severity TEXT DEFAULT 'info',
  p_description TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
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

-- Create function to log data access (for HIPAA compliance)
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_user_id UUID,
  p_accessed_table TEXT,
  p_accessed_record_id UUID,
  p_access_type TEXT,
  p_data_category TEXT DEFAULT 'general',
  p_patient_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_id UUID;
BEGIN
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

-- Create function to check and enforce session limits
CREATE OR REPLACE FUNCTION public.check_session_limits(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Enable realtime for security events (for admin dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;