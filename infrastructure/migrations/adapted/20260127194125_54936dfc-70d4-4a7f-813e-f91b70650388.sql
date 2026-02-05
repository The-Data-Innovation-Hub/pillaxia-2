-- Add prescription_status column to medications table
ALTER TABLE public.medications 
ADD COLUMN prescription_status text NOT NULL DEFAULT 'pending';

-- Add constraint to ensure valid status values
ALTER TABLE public.medications 
ADD CONSTRAINT valid_prescription_status 
CHECK (prescription_status IN ('pending', 'sent', 'ready', 'picked_up', 'completed', 'cancelled'));

-- Add index for faster status filtering
CREATE INDEX idx_medications_prescription_status ON public.medications(prescription_status);

-- Allow pharmacists to view all medications for prescription management
CREATE POLICY "Pharmacists can view all prescriptions"
ON public.medications
FOR SELECT
USING (is_pharmacist(auth.uid()));

-- Allow pharmacists to update prescription status
CREATE POLICY "Pharmacists can update prescription status"
ON public.medications
FOR UPDATE
USING (is_pharmacist(auth.uid()))
WITH CHECK (is_pharmacist(auth.uid()));