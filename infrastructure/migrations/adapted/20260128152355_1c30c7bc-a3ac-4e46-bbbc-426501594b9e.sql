-- Create trusted devices table
CREATE TABLE public.trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_token_hash TEXT NOT NULL,
  device_name TEXT,
  browser TEXT,
  operating_system TEXT,
  ip_address TEXT,
  trusted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on device token hash per user
CREATE UNIQUE INDEX idx_trusted_devices_token ON public.trusted_devices (user_id, device_token_hash) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own trusted devices
CREATE POLICY "Users can view own trusted devices"
ON public.trusted_devices
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own trusted devices
CREATE POLICY "Users can insert own trusted devices"
ON public.trusted_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update (revoke) their own trusted devices
CREATE POLICY "Users can update own trusted devices"
ON public.trusted_devices
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own trusted devices
CREATE POLICY "Users can delete own trusted devices"
ON public.trusted_devices
FOR DELETE
USING (auth.uid() = user_id);

-- Function to check if device is trusted
CREATE OR REPLACE FUNCTION public.is_device_trusted(p_user_id UUID, p_device_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to trust a device
CREATE OR REPLACE FUNCTION public.trust_device(
  p_user_id UUID,
  p_device_token_hash TEXT,
  p_device_name TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id UUID;
BEGIN
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

-- Function to revoke a trusted device
CREATE OR REPLACE FUNCTION public.revoke_trusted_device(p_device_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trusted_devices
  SET is_active = false, revoked_at = now()
  WHERE id = p_device_id
    AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to revoke all trusted devices for a user
CREATE OR REPLACE FUNCTION public.revoke_all_trusted_devices(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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