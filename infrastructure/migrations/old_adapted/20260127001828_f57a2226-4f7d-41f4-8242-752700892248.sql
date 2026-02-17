-- Create patient notification preferences table
CREATE TABLE IF NOT EXISTS public.patient_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_reminders BOOLEAN NOT NULL DEFAULT true,
  in_app_reminders BOOLEAN NOT NULL DEFAULT true,
  email_missed_alerts BOOLEAN NOT NULL DEFAULT true,
  in_app_missed_alerts BOOLEAN NOT NULL DEFAULT true,
  email_encouragements BOOLEAN NOT NULL DEFAULT true,
  in_app_encouragements BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '07:00:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Patients can view their own preferences
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Users can view own notification preferences"
ON public.patient_notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Patients can insert their own preferences
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
ON public.patient_notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Patients can update their own preferences
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Users can update own notification preferences"
ON public.patient_notification_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can view all preferences (for analytics)
DROP POLICY IF EXISTS "Admins can view all notification preferences" ON public.patient_notification_preferences;
CREATE POLICY "Admins can view all notification preferences"
ON public.patient_notification_preferences
FOR SELECT
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_patient_notification_preferences_updated_at ON public.patient_notification_preferences;
CREATE TRIGGER update_patient_notification_preferences_updated_at
BEFORE UPDATE ON public.patient_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();