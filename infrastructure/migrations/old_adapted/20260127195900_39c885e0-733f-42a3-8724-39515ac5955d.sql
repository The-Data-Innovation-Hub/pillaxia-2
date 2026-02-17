-- Create refill_requests table for tracking patient refill requests
CREATE TABLE IF NOT EXISTS public.refill_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  patient_notes TEXT,
  pharmacist_notes TEXT,
  refills_granted INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_refill_requests_status ON public.refill_requests(status);
CREATE INDEX IF NOT EXISTS idx_refill_requests_patient ON public.refill_requests(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_refill_requests_medication ON public.refill_requests(medication_id);

-- Enable Row Level Security
ALTER TABLE public.refill_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Patients can view their own refill requests
DROP POLICY IF EXISTS "Patients can view own refill requests" ON public.refill_requests;
CREATE POLICY "Patients can view own refill requests"
ON public.refill_requests
FOR SELECT
USING (auth.uid() = patient_user_id);

-- Patients can create refill requests for their own medications
DROP POLICY IF EXISTS "Patients can create refill requests" ON public.refill_requests;
CREATE POLICY "Patients can create refill requests"
ON public.refill_requests
FOR INSERT
WITH CHECK (
  auth.uid() = patient_user_id 
  AND EXISTS (
    SELECT 1 FROM public.medications 
    WHERE id = medication_id AND user_id = auth.uid()
  )
);

-- Pharmacists can view all refill requests
DROP POLICY IF EXISTS "Pharmacists can view all refill requests" ON public.refill_requests;
CREATE POLICY "Pharmacists can view all refill requests"
ON public.refill_requests
FOR SELECT
USING (is_pharmacist(auth.uid()));

-- Pharmacists can update refill requests
DROP POLICY IF EXISTS "Pharmacists can update refill requests" ON public.refill_requests;
CREATE POLICY "Pharmacists can update refill requests"
ON public.refill_requests
FOR UPDATE
USING (is_pharmacist(auth.uid()));

-- Admins can view all refill requests
DROP POLICY IF EXISTS "Admins can view all refill requests" ON public.refill_requests;
CREATE POLICY "Admins can view all refill requests"
ON public.refill_requests
FOR SELECT
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_refill_requests_updated_at ON public.refill_requests;
CREATE TRIGGER update_refill_requests_updated_at
BEFORE UPDATE ON public.refill_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();