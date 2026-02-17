-- Create table to track login attempts
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_login_attempts_email_created ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_user_id ON public.login_attempts(user_id);

-- Create table to track account lockouts
CREATE TABLE public.account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 5,
  unlock_token TEXT,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  unlocked_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for lookups
CREATE INDEX idx_account_lockouts_email ON public.account_lockouts(email);
CREATE INDEX idx_account_lockouts_locked_until ON public.account_lockouts(locked_until);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for login_attempts (only admins can view, system can insert)
CREATE POLICY "Admins can view all login attempts"
  ON public.login_attempts FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert login attempts"
  ON public.login_attempts FOR INSERT
  WITH CHECK (true);

-- RLS Policies for account_lockouts
CREATE POLICY "Admins can view all lockouts"
  ON public.account_lockouts FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update lockouts"
  ON public.account_lockouts FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "System can manage lockouts"
  ON public.account_lockouts FOR ALL
  USING (true);

-- Function to record a login attempt and check for lockout
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
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

-- Function to check if an account is locked
CREATE OR REPLACE FUNCTION public.check_account_locked(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to unlock an account (admin only)
CREATE OR REPLACE FUNCTION public.unlock_account(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Add account_locked event type to security_event_type enum
ALTER TYPE public.security_event_type ADD VALUE IF NOT EXISTS 'account_locked';
ALTER TYPE public.security_event_type ADD VALUE IF NOT EXISTS 'account_unlocked';