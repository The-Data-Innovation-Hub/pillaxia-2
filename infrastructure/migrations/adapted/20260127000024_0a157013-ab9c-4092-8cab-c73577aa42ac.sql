-- Update caregiver_messages to support two-way conversation
-- Add sender_type to identify who sent each message
ALTER TABLE public.caregiver_messages 
ADD COLUMN sender_type text NOT NULL DEFAULT 'caregiver' 
CHECK (sender_type IN ('caregiver', 'patient'));

-- Add updated_at for conversation ordering
ALTER TABLE public.caregiver_messages 
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Create index for conversation queries
CREATE INDEX IF NOT EXISTS idx_caregiver_messages_conversation 
ON public.caregiver_messages (patient_user_id, caregiver_user_id, created_at DESC);

-- Allow patients to insert messages (replies)
DROP POLICY IF EXISTS "Patients can send replies to their caregivers" ON public.caregiver_messages;
CREATE POLICY "Patients can send replies to their caregivers" 
ON public.caregiver_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = patient_user_id 
  AND sender_type = 'patient'
  AND is_caregiver_for_patient(patient_user_id, caregiver_user_id)
);

-- Allow caregivers to mark messages as read
DROP POLICY IF EXISTS "Caregivers can mark patient messages as read" ON public.caregiver_messages;
CREATE POLICY "Caregivers can mark patient messages as read" 
ON public.caregiver_messages 
FOR UPDATE 
USING (auth.uid() = caregiver_user_id AND sender_type = 'patient')
WITH CHECK (auth.uid() = caregiver_user_id AND sender_type = 'patient');