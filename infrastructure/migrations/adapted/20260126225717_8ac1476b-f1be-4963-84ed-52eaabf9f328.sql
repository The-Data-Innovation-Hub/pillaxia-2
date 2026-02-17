-- Create medications table
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  dosage_unit TEXT NOT NULL DEFAULT 'mg',
  form TEXT NOT NULL DEFAULT 'tablet', -- tablet, capsule, liquid, injection, etc.
  instructions TEXT,
  prescriber TEXT,
  pharmacy TEXT,
  refills_remaining INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create medication schedules table
CREATE TABLE IF NOT EXISTS public.medication_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  time_of_day TIME NOT NULL,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sunday, 6=Saturday
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  with_food BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create medication logs for adherence tracking
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_time TIMESTAMPTZ NOT NULL,
  taken_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, taken, skipped, missed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create symptom entries table for diary
CREATE TABLE IF NOT EXISTS public.symptom_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symptom_type TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10),
  description TEXT,
  medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_entries ENABLE ROW LEVEL SECURITY;

-- Medications policies
DROP POLICY IF EXISTS "Users can view own medications" ON public.medications;
CREATE POLICY "Users can view own medications" ON public.medications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medications" ON public.medications;
CREATE POLICY "Users can insert own medications" ON public.medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medications" ON public.medications;
CREATE POLICY "Users can update own medications" ON public.medications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medications" ON public.medications;
CREATE POLICY "Users can delete own medications" ON public.medications
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient medications" ON public.medications;
CREATE POLICY "Clinicians can view assigned patient medications" ON public.medications
  FOR SELECT USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Caregivers can view patient medications" ON public.medications;
CREATE POLICY "Caregivers can view patient medications" ON public.medications
  FOR SELECT USING (is_caregiver_for_patient(user_id, auth.uid()));

-- Medication schedules policies
DROP POLICY IF EXISTS "Users can view own schedules" ON public.medication_schedules;
CREATE POLICY "Users can view own schedules" ON public.medication_schedules
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own schedules" ON public.medication_schedules;
CREATE POLICY "Users can insert own schedules" ON public.medication_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own schedules" ON public.medication_schedules;
CREATE POLICY "Users can update own schedules" ON public.medication_schedules
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own schedules" ON public.medication_schedules;
CREATE POLICY "Users can delete own schedules" ON public.medication_schedules
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient schedules" ON public.medication_schedules;
CREATE POLICY "Clinicians can view assigned patient schedules" ON public.medication_schedules
  FOR SELECT USING (is_clinician_assigned(user_id, auth.uid()));

-- Medication logs policies
DROP POLICY IF EXISTS "Users can view own logs" ON public.medication_logs;
CREATE POLICY "Users can view own logs" ON public.medication_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.medication_logs;
CREATE POLICY "Users can insert own logs" ON public.medication_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own logs" ON public.medication_logs;
CREATE POLICY "Users can update own logs" ON public.medication_logs
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient logs" ON public.medication_logs;
CREATE POLICY "Clinicians can view assigned patient logs" ON public.medication_logs
  FOR SELECT USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Caregivers can view patient logs" ON public.medication_logs;
CREATE POLICY "Caregivers can view patient logs" ON public.medication_logs
  FOR SELECT USING (is_caregiver_for_patient(user_id, auth.uid()));

-- Symptom entries policies
DROP POLICY IF EXISTS "Users can view own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can view own symptoms" ON public.symptom_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can insert own symptoms" ON public.symptom_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can update own symptoms" ON public.symptom_entries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own symptoms" ON public.symptom_entries;
CREATE POLICY "Users can delete own symptoms" ON public.symptom_entries
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient symptoms" ON public.symptom_entries;
CREATE POLICY "Clinicians can view assigned patient symptoms" ON public.symptom_entries
  FOR SELECT USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Caregivers can view patient symptoms" ON public.symptom_entries;
CREATE POLICY "Caregivers can view patient symptoms" ON public.symptom_entries
  FOR SELECT USING (is_caregiver_for_patient(user_id, auth.uid()));

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_medications_updated_at ON public.medications;
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON public.medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_user_id ON public.medication_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication_id ON public.medication_schedules(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON public.medication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_scheduled_time ON public.medication_logs(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_medication_logs_status ON public.medication_logs(status);
CREATE INDEX IF NOT EXISTS idx_symptom_entries_user_id ON public.symptom_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_symptom_entries_recorded_at ON public.symptom_entries(recorded_at);