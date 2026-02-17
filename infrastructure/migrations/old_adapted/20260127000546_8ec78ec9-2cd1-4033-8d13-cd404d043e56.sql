-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Admins can view all settings
DROP POLICY IF EXISTS "Admins can view notification settings" ON public.notification_settings;
CREATE POLICY "Admins can view notification settings"
ON public.notification_settings
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Admins can update settings
DROP POLICY IF EXISTS "Admins can update notification settings" ON public.notification_settings;
CREATE POLICY "Admins can update notification settings"
ON public.notification_settings
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Admins can insert settings
DROP POLICY IF EXISTS "Admins can insert notification settings" ON public.notification_settings;
CREATE POLICY "Admins can insert notification settings"
ON public.notification_settings
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Insert default notification settings
INSERT INTO public.notification_settings (setting_key, is_enabled, description) VALUES
  ('medication_reminders', true, 'Send reminders before scheduled medication times'),
  ('missed_dose_alerts', true, 'Alert caregivers when patients miss doses'),
  ('encouragement_messages', true, 'Email and WhatsApp notifications for caregiver messages');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();