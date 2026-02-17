-- Add delivery_status column to clinician_messages table to track per-channel delivery
ALTER TABLE public.clinician_messages 
ADD COLUMN IF NOT EXISTS delivery_status jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.clinician_messages.delivery_status IS 'Tracks delivery status per channel: {"email": {"sent": true, "at": "..."}, "push": {"sent": true, "at": "..."}, "whatsapp": {"sent": true, "at": "..."}}';

-- Create index for performance when querying by delivery status
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_clinician_messages_delivery_status ON public.clinician_messages USING gin(delivery_status);