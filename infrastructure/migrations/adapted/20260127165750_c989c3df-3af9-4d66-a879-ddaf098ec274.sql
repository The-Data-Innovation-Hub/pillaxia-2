-- Add delivered_at timestamp to track when messages were actually delivered
ALTER TABLE public.notification_history 
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone DEFAULT NULL;

-- Add opened_at timestamp to track when emails were opened
ALTER TABLE public.notification_history 
ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone DEFAULT NULL;

-- Add clicked_at timestamp to track when emails were clicked
ALTER TABLE public.notification_history 
ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone DEFAULT NULL;

-- Add index for faster delivery status queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notification_history_delivery_status 
ON public.notification_history (status, delivered_at);