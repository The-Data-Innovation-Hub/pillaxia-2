-- Create table for clinician-patient direct messages
CREATE TABLE public.clinician_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinician_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'clinician' CHECK (sender_type IN ('clinician', 'patient')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinician_messages ENABLE ROW LEVEL SECURITY;

-- Clinicians can send messages to their assigned patients
CREATE POLICY "Clinicians can send messages to assigned patients"
ON public.clinician_messages
FOR INSERT
WITH CHECK (
  auth.uid() = clinician_user_id 
  AND sender_type = 'clinician'
  AND is_clinician_assigned(patient_user_id, auth.uid())
);

-- Patients can reply to their assigned clinicians
CREATE POLICY "Patients can reply to their clinicians"
ON public.clinician_messages
FOR INSERT
WITH CHECK (
  auth.uid() = patient_user_id 
  AND sender_type = 'patient'
  AND is_clinician_assigned(patient_user_id, clinician_user_id)
);

-- Clinicians can view their sent/received messages
CREATE POLICY "Clinicians can view their messages"
ON public.clinician_messages
FOR SELECT
USING (auth.uid() = clinician_user_id);

-- Patients can view messages sent to/from them
CREATE POLICY "Patients can view their messages"
ON public.clinician_messages
FOR SELECT
USING (auth.uid() = patient_user_id);

-- Clinicians can mark patient messages as read
CREATE POLICY "Clinicians can mark patient messages as read"
ON public.clinician_messages
FOR UPDATE
USING (auth.uid() = clinician_user_id AND sender_type = 'patient')
WITH CHECK (auth.uid() = clinician_user_id AND sender_type = 'patient');

-- Patients can mark clinician messages as read
CREATE POLICY "Patients can mark clinician messages as read"
ON public.clinician_messages
FOR UPDATE
USING (auth.uid() = patient_user_id AND sender_type = 'clinician')
WITH CHECK (auth.uid() = patient_user_id AND sender_type = 'clinician');

-- Create indexes for efficient queries
CREATE INDEX idx_clinician_messages_conversation 
ON public.clinician_messages (patient_user_id, clinician_user_id, created_at DESC);

CREATE INDEX idx_clinician_messages_unread
ON public.clinician_messages (patient_user_id, is_read) WHERE is_read = false;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinician_messages;