-- Add dedicated SMS toggle for clinician messages
ALTER TABLE public.patient_notification_preferences
ADD COLUMN sms_clinician_messages boolean NOT NULL DEFAULT true;