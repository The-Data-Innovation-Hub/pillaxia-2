-- Phase 4: Normalize Notification Preferences
-- This migration consolidates 24+ boolean columns across multiple tables
-- into a normalized notification preferences structure.

-- ============================================================
-- PART 1: Create Notification Type and Channel Enums
-- ============================================================

-- Create notification type enum
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    -- Security notifications
    'account_locked',
    'account_unlocked',
    'password_change',
    'password_reset',
    'suspicious_activity',
    'new_device_login',
    'concurrent_session_blocked',
    'mfa_enabled',
    'mfa_disabled',
    'data_export',
    'permission_change',
    -- Patient notifications
    'medication_reminder',
    'missed_medication_alert',
    'refill_reminder',
    'appointment_reminder',
    'lab_result_available',
    'prescription_ready',
    'encouragement_message',
    'clinician_message',
    'vitals_reminder',
    'symptom_check_reminder'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create notification channel enum
DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM (
    'email',
    'push',
    'in_app',
    'sms',
    'whatsapp'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- PART 2: Create Unified Notification Preferences Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type public.notification_type NOT NULL,
  channel public.notification_channel NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, notification_type, channel)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user_id
  ON public.user_notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_type_channel
  ON public.user_notification_preferences(notification_type, channel)
  WHERE is_enabled = true;

-- ============================================================
-- PART 3: Migrate Security Notification Preferences
-- ============================================================

-- Migrate from security_notification_preferences table
INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT
  snp.user_id,
  'account_locked'::public.notification_type,
  'email'::public.notification_channel,
  snp.notify_account_locked AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_account_locked IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'account_locked', 'push', snp.notify_account_locked AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_account_locked IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'account_unlocked', 'email', snp.notify_account_unlocked AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_account_unlocked IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'account_unlocked', 'push', snp.notify_account_unlocked AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_account_unlocked IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'password_change', 'email', snp.notify_password_change AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_password_change IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'password_change', 'push', snp.notify_password_change AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_password_change IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'password_reset', 'email', snp.notify_password_reset AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_password_reset IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'password_reset', 'push', snp.notify_password_reset AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_password_reset IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'suspicious_activity', 'email', snp.notify_suspicious_activity AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_suspicious_activity IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'suspicious_activity', 'push', snp.notify_suspicious_activity AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_suspicious_activity IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'new_device_login', 'email', snp.notify_new_device_login AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_new_device_login IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'new_device_login', 'push', snp.notify_new_device_login AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_new_device_login IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'concurrent_session_blocked', 'email', snp.notify_concurrent_session_blocked AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_concurrent_session_blocked IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'concurrent_session_blocked', 'push', snp.notify_concurrent_session_blocked AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_concurrent_session_blocked IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'mfa_enabled', 'email', snp.notify_mfa_enabled AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_mfa_enabled IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'mfa_enabled', 'push', snp.notify_mfa_enabled AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_mfa_enabled IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'mfa_disabled', 'email', snp.notify_mfa_disabled AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_mfa_disabled IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'mfa_disabled', 'push', snp.notify_mfa_disabled AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_mfa_disabled IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'data_export', 'email', snp.notify_data_export AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_data_export IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'data_export', 'push', snp.notify_data_export AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_data_export IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'permission_change', 'email', snp.notify_permission_change AND snp.email_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_permission_change IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT snp.user_id, 'permission_change', 'push', snp.notify_permission_change AND snp.push_enabled
FROM public.security_notification_preferences snp
WHERE snp.notify_permission_change IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

-- ============================================================
-- PART 4: Migrate Patient Notification Preferences
-- ============================================================

-- Medication reminders
INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'medication_reminder', 'email', pnp.email_reminders
FROM public.patient_notification_preferences pnp
WHERE pnp.email_reminders IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'medication_reminder', 'in_app', pnp.in_app_reminders
FROM public.patient_notification_preferences pnp
WHERE pnp.in_app_reminders IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

-- Missed medication alerts
INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'missed_medication_alert', 'email', pnp.email_missed_alerts
FROM public.patient_notification_preferences pnp
WHERE pnp.email_missed_alerts IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'missed_medication_alert', 'in_app', pnp.in_app_missed_alerts
FROM public.patient_notification_preferences pnp
WHERE pnp.in_app_missed_alerts IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

-- Refill reminders
INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'refill_reminder', 'email', pnp.email_refill_reminders
FROM public.patient_notification_preferences pnp
WHERE pnp.email_refill_reminders IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'refill_reminder', 'in_app', pnp.in_app_refill_reminders
FROM public.patient_notification_preferences pnp
WHERE pnp.in_app_refill_reminders IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

-- Encouragement messages
INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'encouragement_message', 'email', pnp.email_encouragements
FROM public.patient_notification_preferences pnp
WHERE pnp.email_encouragements IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'encouragement_message', 'in_app', pnp.in_app_encouragements
FROM public.patient_notification_preferences pnp
WHERE pnp.in_app_encouragements IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

-- Clinician messages
INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'clinician_message', 'email', pnp.email_clinician_messages
FROM public.patient_notification_preferences pnp
WHERE pnp.email_clinician_messages IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'clinician_message', 'push', pnp.push_clinician_messages
FROM public.patient_notification_preferences pnp
WHERE pnp.push_clinician_messages IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
SELECT pnp.user_id, 'clinician_message', 'whatsapp', pnp.whatsapp_clinician_messages
FROM public.patient_notification_preferences pnp
WHERE pnp.whatsapp_clinician_messages IS NOT NULL
ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

-- ============================================================
-- PART 5: Create Backward-Compatible Views
-- ============================================================

-- View for security_notification_preferences
CREATE OR REPLACE VIEW public.security_notification_preferences_view AS
SELECT
  u.id AS user_id,
  MAX(CASE WHEN unp.notification_type = 'account_locked' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_account_locked,
  MAX(CASE WHEN unp.notification_type = 'account_unlocked' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_account_unlocked,
  MAX(CASE WHEN unp.notification_type = 'password_change' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_password_change,
  MAX(CASE WHEN unp.notification_type = 'password_reset' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_password_reset,
  MAX(CASE WHEN unp.notification_type = 'suspicious_activity' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_suspicious_activity,
  MAX(CASE WHEN unp.notification_type = 'new_device_login' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_new_device_login,
  MAX(CASE WHEN unp.notification_type = 'concurrent_session_blocked' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_concurrent_session_blocked,
  MAX(CASE WHEN unp.notification_type = 'mfa_enabled' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_mfa_enabled,
  MAX(CASE WHEN unp.notification_type = 'mfa_disabled' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_mfa_disabled,
  MAX(CASE WHEN unp.notification_type = 'data_export' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_data_export,
  MAX(CASE WHEN unp.notification_type = 'permission_change' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS notify_permission_change,
  MAX(CASE WHEN unp.channel = 'email' THEN true ELSE false END) AS email_enabled,
  MAX(CASE WHEN unp.channel = 'push' THEN true ELSE false END) AS push_enabled,
  MIN(unp.created_at) AS created_at,
  MAX(unp.updated_at) AS updated_at
FROM public.users u
LEFT JOIN public.user_notification_preferences unp ON u.id = unp.user_id
GROUP BY u.id;

-- View for patient_notification_preferences
CREATE OR REPLACE VIEW public.patient_notification_preferences_view AS
SELECT
  u.id AS user_id,
  MAX(CASE WHEN unp.notification_type = 'medication_reminder' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS email_reminders,
  MAX(CASE WHEN unp.notification_type = 'medication_reminder' AND unp.channel = 'in_app' THEN unp.is_enabled ELSE false END) AS in_app_reminders,
  MAX(CASE WHEN unp.notification_type = 'missed_medication_alert' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS email_missed_alerts,
  MAX(CASE WHEN unp.notification_type = 'missed_medication_alert' AND unp.channel = 'in_app' THEN unp.is_enabled ELSE false END) AS in_app_missed_alerts,
  MAX(CASE WHEN unp.notification_type = 'refill_reminder' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS email_refill_reminders,
  MAX(CASE WHEN unp.notification_type = 'refill_reminder' AND unp.channel = 'in_app' THEN unp.is_enabled ELSE false END) AS in_app_refill_reminders,
  MAX(CASE WHEN unp.notification_type = 'encouragement_message' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS email_encouragements,
  MAX(CASE WHEN unp.notification_type = 'encouragement_message' AND unp.channel = 'in_app' THEN unp.is_enabled ELSE false END) AS in_app_encouragements,
  MAX(CASE WHEN unp.notification_type = 'clinician_message' AND unp.channel = 'email' THEN unp.is_enabled ELSE false END) AS email_clinician_messages,
  MAX(CASE WHEN unp.notification_type = 'clinician_message' AND unp.channel = 'push' THEN unp.is_enabled ELSE false END) AS push_clinician_messages,
  MAX(CASE WHEN unp.notification_type = 'clinician_message' AND unp.channel = 'whatsapp' THEN unp.is_enabled ELSE false END) AS whatsapp_clinician_messages,
  MIN(unp.created_at) AS created_at,
  MAX(unp.updated_at) AS updated_at
FROM public.users u
LEFT JOIN public.user_notification_preferences unp ON u.id = unp.user_id
GROUP BY u.id;

-- ============================================================
-- PART 6: Drop Original Tables (Optional - commented out for safety)
-- ============================================================

-- Uncomment these after verifying the migration works correctly:

-- DROP TABLE IF EXISTS public.security_notification_preferences CASCADE;
-- DROP TABLE IF EXISTS public.patient_notification_preferences CASCADE;

-- ============================================================
-- PART 7: Create Helper Functions
-- ============================================================

-- Function to check if a notification is enabled
CREATE OR REPLACE FUNCTION public.is_notification_enabled(
  p_user_id uuid,
  p_notification_type public.notification_type,
  p_channel public.notification_channel
) RETURNS boolean AS $$
DECLARE
  v_is_enabled boolean;
BEGIN
  SELECT is_enabled INTO v_is_enabled
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id
    AND notification_type = p_notification_type
    AND channel = p_channel;

  RETURN COALESCE(v_is_enabled, true); -- Default to enabled if not found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set notification preference
CREATE OR REPLACE FUNCTION public.set_notification_preference(
  p_user_id uuid,
  p_notification_type public.notification_type,
  p_channel public.notification_channel,
  p_is_enabled boolean
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.user_notification_preferences (user_id, notification_type, channel, is_enabled)
  VALUES (p_user_id, p_notification_type, p_channel, p_is_enabled)
  ON CONFLICT (user_id, notification_type, channel)
  DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Success Message
-- ============================================================

SELECT 'Phase 4 migration completed: Normalized notification preferences (24+ boolean columns consolidated)' AS status;
