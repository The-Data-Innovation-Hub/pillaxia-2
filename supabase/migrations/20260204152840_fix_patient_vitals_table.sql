-- ============================================================
-- PHASE 2: Fix patient_vitals table - Remove derived BMI column
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Create view with computed BMI before removing column
-- ============================================================

CREATE OR REPLACE VIEW public.patient_vitals_with_bmi AS
SELECT 
  id,
  user_id,
  recorded_at,
  recorded_by,
  blood_pressure_systolic,
  blood_pressure_diastolic,
  heart_rate,
  temperature,
  respiratory_rate,
  oxygen_saturation,
  weight,
  height,
  -- Computed BMI: weight (kg) / (height (cm) / 100)^2
  CASE 
    WHEN height > 0 AND weight > 0 THEN
      ROUND((weight / POWER(height / 100.0, 2))::NUMERIC, 1)
    ELSE NULL
  END AS bmi,
  blood_glucose,
  notes,
  is_fasting,
  measurement_location,
  created_at,
  updated_at
FROM public.patient_vitals;

-- Grant access
GRANT SELECT ON public.patient_vitals_with_bmi TO authenticated;

-- ============================================================
-- Step 2: Remove derived BMI column
-- ============================================================

ALTER TABLE public.patient_vitals DROP COLUMN IF EXISTS bmi;

-- Add comment
COMMENT ON VIEW public.patient_vitals_with_bmi IS 
  'Patient vitals with computed BMI. BMI is calculated from weight and height. Part of 3NF compliance.';

COMMENT ON TABLE public.patient_vitals IS 
  'Patient vital signs. BMI should be computed from weight and height, not stored. Use patient_vitals_with_bmi view. Part of 3NF compliance.';
