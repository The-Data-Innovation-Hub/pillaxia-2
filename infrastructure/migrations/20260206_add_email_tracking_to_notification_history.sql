-- Add email tracking columns to notification_history.
-- These columns are required by the NotificationAnalyticsPage admin component
-- to display delivery, open, and click metrics for notifications.
ALTER TABLE public.notification_history
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
