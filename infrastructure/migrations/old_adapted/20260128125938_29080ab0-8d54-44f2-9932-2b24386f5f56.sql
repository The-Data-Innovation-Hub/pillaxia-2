-- Create security notification preferences table
CREATE TABLE IF NOT EXISTS public.security_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Security alert toggles
  notify_account_locked BOOLEAN NOT NULL DEFAULT true,
  notify_account_unlocked BOOLEAN NOT NULL DEFAULT true,
  notify_password_change BOOLEAN NOT NULL DEFAULT true,
  notify_password_reset BOOLEAN NOT NULL DEFAULT true,
  notify_suspicious_activity BOOLEAN NOT NULL DEFAULT true,
  notify_new_device_login BOOLEAN NOT NULL DEFAULT true,
  notify_concurrent_session_blocked BOOLEAN NOT NULL DEFAULT true,
  notify_mfa_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_mfa_disabled BOOLEAN NOT NULL DEFAULT true,
  notify_data_export BOOLEAN NOT NULL DEFAULT true,
  notify_permission_change BOOLEAN NOT NULL DEFAULT true,
  -- Delivery channel preferences
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own security notification preferences" ON public.security_notification_preferences;
CREATE POLICY "Users can view own security notification preferences"
ON public.security_notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own security notification preferences" ON public.security_notification_preferences;
CREATE POLICY "Users can insert own security notification preferences"
ON public.security_notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own security notification preferences" ON public.security_notification_preferences;
CREATE POLICY "Users can update own security notification preferences"
ON public.security_notification_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_security_notification_preferences_updated_at ON public.security_notification_preferences;
CREATE TRIGGER update_security_notification_preferences_updated_at
BEFORE UPDATE ON public.security_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();