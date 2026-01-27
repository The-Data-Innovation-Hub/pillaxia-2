-- Add grace period setting (in minutes)
INSERT INTO public.notification_settings (setting_key, is_enabled, description)
VALUES ('missed_dose_grace_period', true, '30')
ON CONFLICT (setting_key) DO NOTHING;

-- Note: We're using 'description' to store the value and 'is_enabled' as a flag
-- A cleaner approach would be a separate settings table, but this works for now