-- Create table for tracking user login locations
CREATE TABLE public.user_login_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Unknown',
  region TEXT DEFAULT 'Unknown',
  country TEXT NOT NULL DEFAULT 'Unknown',
  country_code TEXT DEFAULT 'XX',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone TEXT,
  isp TEXT,
  user_agent TEXT,
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  action TEXT NOT NULL DEFAULT 'login',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_login_locations ENABLE ROW LEVEL SECURITY;

-- Users can view their own login locations
CREATE POLICY "Users can view own login locations"
ON public.user_login_locations
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert login locations (via edge function with service role)
CREATE POLICY "System can insert login locations"
ON public.user_login_locations
FOR INSERT
WITH CHECK (true);

-- Users can update their own locations (mark as trusted)
CREATE POLICY "Users can update own login locations"
ON public.user_login_locations
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all login locations
CREATE POLICY "Admins can view all login locations"
ON public.user_login_locations
FOR SELECT
USING (is_admin(auth.uid()));

-- Add new security event type for login locations
ALTER TYPE public.security_event_type ADD VALUE IF NOT EXISTS 'new_login_location';

-- Create index for faster lookups
CREATE INDEX idx_user_login_locations_user_id ON public.user_login_locations(user_id);
CREATE INDEX idx_user_login_locations_created_at ON public.user_login_locations(created_at DESC);