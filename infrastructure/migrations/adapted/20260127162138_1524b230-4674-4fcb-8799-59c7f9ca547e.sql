-- Create SOAP notes table for clinician documentation
CREATE TABLE IF NOT EXISTS public.soap_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinician_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for SOAP notes
DROP POLICY IF EXISTS "Clinicians can view their own notes" ON public.soap_notes;
CREATE POLICY "Clinicians can view their own notes"
  ON public.soap_notes FOR SELECT
  USING (auth.uid() = clinician_user_id);

DROP POLICY IF EXISTS "Clinicians can create notes for assigned patients" ON public.soap_notes;
CREATE POLICY "Clinicians can create notes for assigned patients"
  ON public.soap_notes FOR INSERT
  WITH CHECK (
    auth.uid() = clinician_user_id AND
    is_clinician_assigned(patient_user_id, auth.uid())
  );

DROP POLICY IF EXISTS "Clinicians can update their own notes" ON public.soap_notes;
CREATE POLICY "Clinicians can update their own notes"
  ON public.soap_notes FOR UPDATE
  USING (auth.uid() = clinician_user_id)
  WITH CHECK (auth.uid() = clinician_user_id);

DROP POLICY IF EXISTS "Clinicians can delete their own notes" ON public.soap_notes;
CREATE POLICY "Clinicians can delete their own notes"
  ON public.soap_notes FOR DELETE
  USING (auth.uid() = clinician_user_id);

-- Create red flag alerts table
CREATE TABLE IF NOT EXISTS public.red_flag_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  clinician_user_id UUID NOT NULL,
  symptom_entry_id UUID REFERENCES public.symptom_entries(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'severe_symptom',
  severity INTEGER NOT NULL,
  symptom_type TEXT NOT NULL,
  description TEXT,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on red flag alerts
ALTER TABLE public.red_flag_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for red flag alerts
DROP POLICY IF EXISTS "Clinicians can view alerts for their patients" ON public.red_flag_alerts;
CREATE POLICY "Clinicians can view alerts for their patients"
  ON public.red_flag_alerts FOR SELECT
  USING (
    auth.uid() = clinician_user_id OR 
    is_clinician_assigned(patient_user_id, auth.uid())
  );

DROP POLICY IF EXISTS "Patients can view their own alerts" ON public.red_flag_alerts;
CREATE POLICY "Patients can view their own alerts"
  ON public.red_flag_alerts FOR SELECT
  USING (auth.uid() = patient_user_id);

DROP POLICY IF EXISTS "Clinicians can update alerts they can see" ON public.red_flag_alerts;
CREATE POLICY "Clinicians can update alerts they can see"
  ON public.red_flag_alerts FOR UPDATE
  USING (
    auth.uid() = clinician_user_id OR 
    is_clinician_assigned(patient_user_id, auth.uid())
  );

-- Create polypharmacy warnings table
CREATE TABLE IF NOT EXISTS public.polypharmacy_warnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  medication_count INTEGER NOT NULL,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.polypharmacy_warnings ENABLE ROW LEVEL SECURITY;

-- Policies for polypharmacy warnings
DROP POLICY IF EXISTS "Clinicians can view polypharmacy warnings for assigned patients" ON public.polypharmacy_warnings;
CREATE POLICY "Clinicians can view polypharmacy warnings for assigned patients"
  ON public.polypharmacy_warnings FOR SELECT
  USING (is_clinician_assigned(patient_user_id, auth.uid()));

DROP POLICY IF EXISTS "Clinicians can update polypharmacy warnings" ON public.polypharmacy_warnings;
CREATE POLICY "Clinicians can update polypharmacy warnings"
  ON public.polypharmacy_warnings FOR UPDATE
  USING (is_clinician_assigned(patient_user_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can view all polypharmacy warnings" ON public.polypharmacy_warnings;
CREATE POLICY "Admins can view all polypharmacy warnings"
  ON public.polypharmacy_warnings FOR SELECT
  USING (is_admin(auth.uid()));

-- Add trigger for updated_at on SOAP notes
DROP TRIGGER IF EXISTS update_soap_notes_updated_at ON public.soap_notes;
CREATE TRIGGER update_soap_notes_updated_at
  BEFORE UPDATE ON public.soap_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on polypharmacy warnings  
DROP TRIGGER IF EXISTS update_polypharmacy_warnings_updated_at ON public.polypharmacy_warnings;
CREATE TRIGGER update_polypharmacy_warnings_updated_at
  BEFORE UPDATE ON public.polypharmacy_warnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for red flag alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_flag_alerts;