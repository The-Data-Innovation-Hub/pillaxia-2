-- Add native_token column to push_subscriptions for APNs/native device tokens
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS native_token TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web';

-- Add index for faster lookups by platform
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_push_subscriptions_platform ON public.push_subscriptions(platform);

-- Add comment for clarity
COMMENT ON COLUMN public.push_subscriptions.native_token IS 'APNs device token for iOS or native token for Android';
COMMENT ON COLUMN public.push_subscriptions.platform IS 'Platform: web, ios, or android';