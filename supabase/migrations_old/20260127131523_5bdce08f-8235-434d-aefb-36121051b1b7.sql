-- Add clinician message notification preferences columns
ALTER TABLE public.patient_notification_preferences
ADD COLUMN IF NOT EXISTS email_clinician_messages boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS push_clinician_messages boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_clinician_messages boolean NOT NULL DEFAULT true;