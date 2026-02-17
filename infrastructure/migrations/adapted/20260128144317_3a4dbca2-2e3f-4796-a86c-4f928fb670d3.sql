
-- Create patient vitals table for tracking health measurements
CREATE TABLE IF NOT EXISTS public.patient_vitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recorded_by UUID, -- clinician who recorded, null if self-reported
  
  -- Vital signs
  blood_pressure_systolic INTEGER, -- mmHg
  blood_pressure_diastolic INTEGER, -- mmHg
  heart_rate INTEGER, -- bpm
  temperature NUMERIC(4,1), -- Celsius
  respiratory_rate INTEGER, -- breaths per minute
  oxygen_saturation INTEGER, -- percentage (SpO2)
  weight NUMERIC(5,2), -- kg
  height NUMERIC(5,2), -- cm
  bmi NUMERIC(4,1), -- calculated
  blood_glucose NUMERIC(5,1), -- mg/dL
  
  -- Additional context
  notes TEXT,
  is_fasting BOOLEAN DEFAULT false,
  measurement_location TEXT, -- e.g., 'left arm', 'right arm' for BP
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lab results table
CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ordered_by UUID, -- clinician who ordered
  
  -- Lab info
  test_name TEXT NOT NULL,
  test_code TEXT, -- e.g., CPT code
  category TEXT NOT NULL DEFAULT 'general', -- blood, urine, imaging, etc.
  
  -- Results
  result_value TEXT NOT NULL,
  result_unit TEXT,
  reference_range TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
  is_abnormal BOOLEAN DEFAULT false,
  abnormal_flag TEXT, -- 'high', 'low', 'critical'
  
  -- Dates
  ordered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  collected_at TIMESTAMP WITH TIME ZONE,
  resulted_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional info
  lab_name TEXT,
  notes TEXT,
  attachment_url TEXT, -- for PDF reports
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vitals alerts table for abnormal readings
CREATE TABLE IF NOT EXISTS public.vitals_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vital_id UUID REFERENCES public.patient_vitals(id) ON DELETE CASCADE,
  
  alert_type TEXT NOT NULL, -- 'blood_pressure', 'heart_rate', 'glucose', etc.
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for patient_vitals
DROP POLICY IF EXISTS "Patients can view own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can view own vitals"
  ON public.patient_vitals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Patients can insert own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can insert own vitals"
  ON public.patient_vitals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Patients can update own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can update own vitals"
  ON public.patient_vitals FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Patients can delete own vitals" ON public.patient_vitals;
CREATE POLICY "Patients can delete own vitals"
  ON public.patient_vitals FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient vitals" ON public.patient_vitals;
CREATE POLICY "Clinicians can view assigned patient vitals"
  ON public.patient_vitals FOR SELECT
  USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Clinicians can insert vitals for assigned patients" ON public.patient_vitals;
CREATE POLICY "Clinicians can insert vitals for assigned patients"
  ON public.patient_vitals FOR INSERT
  WITH CHECK (is_clinician_assigned(user_id, auth.uid()) AND recorded_by = auth.uid());

DROP POLICY IF EXISTS "Caregivers can view patient vitals" ON public.patient_vitals;
CREATE POLICY "Caregivers can view patient vitals"
  ON public.patient_vitals FOR SELECT
  USING (is_caregiver_for_patient(user_id, auth.uid()));

-- RLS Policies for lab_results
DROP POLICY IF EXISTS "Patients can view own lab results" ON public.lab_results;
CREATE POLICY "Patients can view own lab results"
  ON public.lab_results FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient labs" ON public.lab_results;
CREATE POLICY "Clinicians can view assigned patient labs"
  ON public.lab_results FOR SELECT
  USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Clinicians can manage labs for assigned patients" ON public.lab_results;
CREATE POLICY "Clinicians can manage labs for assigned patients"
  ON public.lab_results FOR ALL
  USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Caregivers can view patient lab results" ON public.lab_results;
CREATE POLICY "Caregivers can view patient lab results"
  ON public.lab_results FOR SELECT
  USING (is_caregiver_for_patient(user_id, auth.uid()));

-- RLS Policies for vitals_alerts
DROP POLICY IF EXISTS "Patients can view own vitals alerts" ON public.vitals_alerts;
CREATE POLICY "Patients can view own vitals alerts"
  ON public.vitals_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient alerts" ON public.vitals_alerts;
CREATE POLICY "Clinicians can view assigned patient alerts"
  ON public.vitals_alerts FOR SELECT
  USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Clinicians can acknowledge alerts" ON public.vitals_alerts;
CREATE POLICY "Clinicians can acknowledge alerts"
  ON public.vitals_alerts FOR UPDATE
  USING (is_clinician_assigned(user_id, auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_vitals_user_id ON public.patient_vitals(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at ON public.patient_vitals(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_results_user_id ON public.lab_results(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_status ON public.lab_results(status);
CREATE INDEX IF NOT EXISTS idx_vitals_alerts_user_id ON public.vitals_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_vitals_alerts_severity ON public.vitals_alerts(severity);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_patient_vitals_updated_at ON public.patient_vitals;
CREATE TRIGGER update_patient_vitals_updated_at
  BEFORE UPDATE ON public.patient_vitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lab_results_updated_at ON public.lab_results;
CREATE TRIGGER update_lab_results_updated_at
  BEFORE UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
