-- Create prescriptions table for e-prescribing workflow
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Prescription identifiers
  prescription_number TEXT NOT NULL UNIQUE,
  -- Parties involved
  patient_user_id UUID NOT NULL,
  clinician_user_id UUID NOT NULL,
  pharmacy_id UUID REFERENCES public.pharmacy_locations(id),
  -- Medication details
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT NOT NULL,
  dosage_unit TEXT NOT NULL DEFAULT 'mg',
  form TEXT NOT NULL DEFAULT 'tablet',
  quantity INTEGER NOT NULL,
  refills_authorized INTEGER NOT NULL DEFAULT 0,
  refills_remaining INTEGER NOT NULL DEFAULT 0,
  -- Instructions
  sig TEXT NOT NULL, -- Directions for use (e.g., "Take 1 tablet by mouth twice daily")
  instructions TEXT,
  -- Dates
  date_written DATE NOT NULL DEFAULT CURRENT_DATE,
  date_expires DATE,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'sent', 'received', 'processing', 'ready', 'dispensed', 'cancelled', 'expired')),
  -- Clinical flags
  is_controlled_substance BOOLEAN NOT NULL DEFAULT false,
  dea_schedule TEXT,
  dispense_as_written BOOLEAN NOT NULL DEFAULT false,
  -- Diagnosis (optional)
  diagnosis_code TEXT,
  diagnosis_description TEXT,
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  dispensed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prescription status history for audit trail
CREATE TABLE public.prescription_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prescriptions
CREATE POLICY "Patients can view their own prescriptions"
ON public.prescriptions FOR SELECT
USING (auth.uid() = patient_user_id);

CREATE POLICY "Clinicians can view prescriptions they wrote"
ON public.prescriptions FOR SELECT
USING (auth.uid() = clinician_user_id);

CREATE POLICY "Clinicians can create prescriptions for assigned patients"
ON public.prescriptions FOR INSERT
WITH CHECK (
  auth.uid() = clinician_user_id 
  AND is_clinician(auth.uid()) 
  AND is_clinician_assigned(patient_user_id, auth.uid())
);

CREATE POLICY "Clinicians can update their own prescriptions"
ON public.prescriptions FOR UPDATE
USING (auth.uid() = clinician_user_id AND is_clinician(auth.uid()))
WITH CHECK (auth.uid() = clinician_user_id);

CREATE POLICY "Pharmacists can view prescriptions for their pharmacy"
ON public.prescriptions FOR SELECT
USING (
  is_pharmacist(auth.uid()) 
  AND pharmacy_id IN (SELECT id FROM public.pharmacy_locations WHERE pharmacist_user_id = auth.uid())
);

CREATE POLICY "Pharmacists can update prescription status"
ON public.prescriptions FOR UPDATE
USING (
  is_pharmacist(auth.uid()) 
  AND pharmacy_id IN (SELECT id FROM public.pharmacy_locations WHERE pharmacist_user_id = auth.uid())
);

CREATE POLICY "Admins can view all prescriptions"
ON public.prescriptions FOR SELECT
USING (is_admin(auth.uid()));

-- RLS Policies for prescription history
CREATE POLICY "Users can view history of their prescriptions"
ON public.prescription_status_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.prescriptions p 
    WHERE p.id = prescription_id 
    AND (p.patient_user_id = auth.uid() OR p.clinician_user_id = auth.uid())
  )
);

CREATE POLICY "Pharmacists can view history of their prescriptions"
ON public.prescription_status_history FOR SELECT
USING (
  is_pharmacist(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.prescriptions p 
    WHERE p.id = prescription_id 
    AND p.pharmacy_id IN (SELECT id FROM public.pharmacy_locations WHERE pharmacist_user_id = auth.uid())
  )
);

CREATE POLICY "Authorized users can insert history"
ON public.prescription_status_history FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.prescriptions p 
    WHERE p.id = prescription_id 
    AND (p.clinician_user_id = auth.uid() OR is_pharmacist(auth.uid()))
  )
);

-- Indexes for performance
CREATE INDEX idx_prescriptions_patient ON public.prescriptions(patient_user_id);
CREATE INDEX idx_prescriptions_clinician ON public.prescriptions(clinician_user_id);
CREATE INDEX idx_prescriptions_pharmacy ON public.prescriptions(pharmacy_id);
CREATE INDEX idx_prescriptions_status ON public.prescriptions(status);
CREATE INDEX idx_prescriptions_number ON public.prescriptions(prescription_number);

-- Trigger for updated_at
CREATE TRIGGER update_prescriptions_updated_at
BEFORE UPDATE ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate prescription number
CREATE OR REPLACE FUNCTION public.generate_prescription_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT := 'RX';
  date_part TEXT := to_char(CURRENT_DATE, 'YYMMDD');
  random_part TEXT := lpad(floor(random() * 10000)::text, 4, '0');
  new_number TEXT;
BEGIN
  new_number := prefix || date_part || random_part;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.prescriptions WHERE prescription_number = new_number) LOOP
    random_part := lpad(floor(random() * 10000)::text, 4, '0');
    new_number := prefix || date_part || random_part;
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Enable realtime for prescriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescriptions;