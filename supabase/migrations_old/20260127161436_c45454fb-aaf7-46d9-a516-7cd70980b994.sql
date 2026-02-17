-- Patient Health Profile Tables

-- Chronic conditions table
CREATE TABLE public.patient_chronic_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  condition_name text NOT NULL,
  diagnosed_date date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Allergies table
CREATE TABLE public.patient_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  allergen text NOT NULL,
  reaction_type text, -- e.g., 'mild', 'moderate', 'severe', 'anaphylaxis'
  reaction_description text,
  is_drug_allergy boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Emergency contacts table
CREATE TABLE public.patient_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Drug interactions knowledge base
CREATE TABLE public.drug_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a text NOT NULL,
  drug_b text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe', 'contraindicated')),
  description text NOT NULL,
  recommendation text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_chronic_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for chronic conditions
CREATE POLICY "Users can view own chronic conditions"
ON public.patient_chronic_conditions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chronic conditions"
ON public.patient_chronic_conditions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chronic conditions"
ON public.patient_chronic_conditions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chronic conditions"
ON public.patient_chronic_conditions FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Clinicians can view assigned patient conditions"
ON public.patient_chronic_conditions FOR SELECT
USING (is_clinician_assigned(user_id, auth.uid()));

CREATE POLICY "Caregivers can view patient conditions"
ON public.patient_chronic_conditions FOR SELECT
USING (is_caregiver_for_patient(user_id, auth.uid()));

-- RLS policies for allergies
CREATE POLICY "Users can view own allergies"
ON public.patient_allergies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own allergies"
ON public.patient_allergies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own allergies"
ON public.patient_allergies FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own allergies"
ON public.patient_allergies FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Clinicians can view assigned patient allergies"
ON public.patient_allergies FOR SELECT
USING (is_clinician_assigned(user_id, auth.uid()));

CREATE POLICY "Caregivers can view patient allergies"
ON public.patient_allergies FOR SELECT
USING (is_caregiver_for_patient(user_id, auth.uid()));

-- RLS policies for emergency contacts
CREATE POLICY "Users can view own emergency contacts"
ON public.patient_emergency_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emergency contacts"
ON public.patient_emergency_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emergency contacts"
ON public.patient_emergency_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own emergency contacts"
ON public.patient_emergency_contacts FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Clinicians can view assigned patient emergency contacts"
ON public.patient_emergency_contacts FOR SELECT
USING (is_clinician_assigned(user_id, auth.uid()));

CREATE POLICY "Caregivers can view patient emergency contacts"
ON public.patient_emergency_contacts FOR SELECT
USING (is_caregiver_for_patient(user_id, auth.uid()));

-- RLS policies for drug interactions (read-only for all authenticated users)
CREATE POLICY "Anyone can view drug interactions"
ON public.drug_interactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage drug interactions"
ON public.drug_interactions FOR ALL
USING (is_admin(auth.uid()));

-- Timestamp triggers
CREATE TRIGGER update_patient_chronic_conditions_updated_at
BEFORE UPDATE ON public.patient_chronic_conditions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_allergies_updated_at
BEFORE UPDATE ON public.patient_allergies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_emergency_contacts_updated_at
BEFORE UPDATE ON public.patient_emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some common drug interactions
INSERT INTO public.drug_interactions (drug_a, drug_b, severity, description, recommendation) VALUES
('warfarin', 'aspirin', 'severe', 'Increased risk of bleeding when taken together', 'Avoid combination unless specifically directed by physician'),
('metformin', 'alcohol', 'moderate', 'Alcohol increases the risk of lactic acidosis', 'Limit alcohol consumption'),
('lisinopril', 'potassium', 'moderate', 'May cause dangerously high potassium levels', 'Monitor potassium levels regularly'),
('simvastatin', 'grapefruit', 'moderate', 'Grapefruit can increase statin levels in blood', 'Avoid grapefruit products'),
('methotrexate', 'ibuprofen', 'severe', 'NSAIDs can increase methotrexate toxicity', 'Use with extreme caution'),
('ssri', 'tramadol', 'severe', 'Risk of serotonin syndrome', 'Avoid combination'),
('digoxin', 'amiodarone', 'severe', 'Amiodarone increases digoxin levels significantly', 'Reduce digoxin dose by 50%'),
('ciprofloxacin', 'antacids', 'moderate', 'Antacids reduce ciprofloxacin absorption', 'Take 2 hours apart'),
('metronidazole', 'alcohol', 'severe', 'Causes severe nausea, vomiting, and flushing', 'Avoid alcohol during treatment'),
('theophylline', 'caffeine', 'moderate', 'Caffeine can increase theophylline side effects', 'Limit caffeine intake');