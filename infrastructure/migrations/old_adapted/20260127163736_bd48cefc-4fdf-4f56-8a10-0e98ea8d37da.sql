-- Add SMS reminder preference column
ALTER TABLE public.patient_notification_preferences
ADD COLUMN sms_reminders boolean NOT NULL DEFAULT true;