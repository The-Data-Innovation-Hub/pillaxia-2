-- Create table for caregiver encouragement messages
CREATE TABLE IF NOT EXISTS public.caregiver_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.caregiver_messages ENABLE ROW LEVEL SECURITY;

-- Caregivers can insert messages for patients they care for
DROP POLICY IF EXISTS "Caregivers can send messages to their patients" ON public.caregiver_messages;
CREATE POLICY "Caregivers can send messages to their patients"
ON public.caregiver_messages
FOR INSERT
WITH CHECK (
  auth.uid() = caregiver_user_id 
  AND is_caregiver_for_patient(patient_user_id, auth.uid())
);

-- Caregivers can view messages they sent
DROP POLICY IF EXISTS "Caregivers can view their sent messages" ON public.caregiver_messages;
CREATE POLICY "Caregivers can view their sent messages"
ON public.caregiver_messages
FOR SELECT
USING (auth.uid() = caregiver_user_id);

-- Patients can view messages sent to them
DROP POLICY IF EXISTS "Patients can view their received messages" ON public.caregiver_messages;
CREATE POLICY "Patients can view their received messages"
ON public.caregiver_messages
FOR SELECT
USING (auth.uid() = patient_user_id);

-- Patients can update (mark as read) their received messages
DROP POLICY IF EXISTS "Patients can mark messages as read" ON public.caregiver_messages;
CREATE POLICY "Patients can mark messages as read"
ON public.caregiver_messages
FOR UPDATE
USING (auth.uid() = patient_user_id)
WITH CHECK (auth.uid() = patient_user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.caregiver_messages;