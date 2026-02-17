-- Create patient risk flags table
CREATE TABLE public.patient_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id uuid NOT NULL,
  clinician_user_id uuid NOT NULL,
  flag_type text NOT NULL CHECK (flag_type IN ('no_logging', 'low_adherence')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  description text,
  metric_value numeric,
  days_since_last_log integer,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(patient_user_id, clinician_user_id, flag_type, is_resolved)
);

-- Enable RLS
ALTER TABLE public.patient_risk_flags ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_patient_risk_flags_clinician ON public.patient_risk_flags(clinician_user_id);
CREATE INDEX idx_patient_risk_flags_patient ON public.patient_risk_flags(patient_user_id);
CREATE INDEX idx_patient_risk_flags_unresolved ON public.patient_risk_flags(is_resolved) WHERE is_resolved = false;

-- RLS Policies
CREATE POLICY "Clinicians can view risk flags for their patients"
ON public.patient_risk_flags
FOR SELECT
USING (auth.uid() = clinician_user_id OR is_clinician_assigned(patient_user_id, auth.uid()));

CREATE POLICY "Clinicians can update risk flags they can see"
ON public.patient_risk_flags
FOR UPDATE
USING (auth.uid() = clinician_user_id OR is_clinician_assigned(patient_user_id, auth.uid()));

CREATE POLICY "Admins can view all risk flags"
ON public.patient_risk_flags
FOR SELECT
USING (is_admin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_patient_risk_flags_updated_at
BEFORE UPDATE ON public.patient_risk_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();