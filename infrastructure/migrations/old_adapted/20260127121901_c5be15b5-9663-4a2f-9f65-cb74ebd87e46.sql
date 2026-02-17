-- Create notification history table
CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'in_app', 'whatsapp')),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification history
DROP POLICY IF EXISTS "Users can view own notification history" ON public.notification_history;
CREATE POLICY "Users can view own notification history"
ON public.notification_history
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert (edge functions use service role)
-- No INSERT policy needed for regular users since edge functions use service role key

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_history_user_created 
ON public.notification_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_channel 
ON public.notification_history (user_id, channel, created_at DESC);