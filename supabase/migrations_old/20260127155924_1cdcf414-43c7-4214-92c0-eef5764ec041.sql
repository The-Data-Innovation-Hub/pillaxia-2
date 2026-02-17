-- Create table for 2FA recovery codes
CREATE TABLE public.mfa_recovery_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own recovery codes
CREATE POLICY "Users can view own recovery codes"
ON public.mfa_recovery_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert own recovery codes
CREATE POLICY "Users can insert own recovery codes"
ON public.mfa_recovery_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update own recovery codes (mark as used)
CREATE POLICY "Users can update own recovery codes"
ON public.mfa_recovery_codes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete own recovery codes
CREATE POLICY "Users can delete own recovery codes"
ON public.mfa_recovery_codes
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_mfa_recovery_codes_user_id ON public.mfa_recovery_codes(user_id);