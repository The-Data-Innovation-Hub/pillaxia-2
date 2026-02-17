-- Add retry tracking columns to notification_history
ALTER TABLE public.notification_history
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_retry_at timestamp with time zone;

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notification_history_retry 
ON public.notification_history (next_retry_at, retry_count, status) 
WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Add comment explaining the retry logic
COMMENT ON COLUMN public.notification_history.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN public.notification_history.max_retries IS 'Maximum number of retries allowed (default 3)';
COMMENT ON COLUMN public.notification_history.next_retry_at IS 'When the next retry should be attempted';
COMMENT ON COLUMN public.notification_history.last_retry_at IS 'When the last retry was attempted';