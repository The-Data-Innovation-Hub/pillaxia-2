-- Add delivery_status column to clinician_messages.
-- Tracks the delivery state of messages (sent, delivered, read, failed).
-- Stored as JSONB to support multi-channel delivery tracking
-- (email, push, whatsapp) each with their own status.
ALTER TABLE public.clinician_messages
  ADD COLUMN IF NOT EXISTS delivery_status JSONB DEFAULT '{"sent": true}'::jsonb;
