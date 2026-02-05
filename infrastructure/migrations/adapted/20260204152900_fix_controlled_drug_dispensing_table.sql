-- ============================================================
-- PHASE 2: Fix controlled_drug_dispensing table - Add FKs, migrate data
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Add FK columns
-- ============================================================

-- Add patient_user_id FK
ALTER TABLE public.controlled_drug_dispensing
  ADD COLUMN IF NOT EXISTS patient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add prescriber_user_id FK
ALTER TABLE public.controlled_drug_dispensing
  ADD COLUMN IF NOT EXISTS prescriber_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add prescription_id FK
ALTER TABLE public.controlled_drug_dispensing
  ADD COLUMN IF NOT EXISTS prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_patient_user_id ON public.controlled_drug_dispensing(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_prescriber_user_id ON public.controlled_drug_dispensing(prescriber_user_id);
CREATE INDEX IF NOT EXISTS idx_controlled_drug_dispensing_prescription_id ON public.controlled_drug_dispensing(prescription_id);

-- ============================================================
-- Step 2: Create function to migrate existing TEXT data to FKs
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_controlled_drug_dispensing_to_fks()
RETURNS TABLE(
  patient_matched INTEGER,
  prescriber_matched INTEGER,
  prescription_matched INTEGER,
  patient_unmatched INTEGER,
  prescriber_unmatched INTEGER,
  prescription_unmatched INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_matched INTEGER := 0;
  v_prescriber_matched INTEGER := 0;
  v_prescription_matched INTEGER := 0;
  v_patient_unmatched INTEGER := 0;
  v_prescriber_unmatched INTEGER := 0;
  v_prescription_unmatched INTEGER := 0;
BEGIN
  -- Migrate patient_name to patient_user_id
  -- Try to match by name in profiles
  UPDATE public.controlled_drug_dispensing cdd
  SET patient_user_id = (
    SELECT p.user_id
    FROM public.profiles p
    WHERE LOWER(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')))) = LOWER(TRIM(cdd.patient_name))
    LIMIT 1
  )
  WHERE cdd.patient_name IS NOT NULL 
    AND cdd.patient_name != ''
    AND cdd.patient_user_id IS NULL;
  
  GET DIAGNOSTICS v_patient_matched = ROW_COUNT;
  
  -- Count unmatched patients
  SELECT COUNT(*) INTO v_patient_unmatched
  FROM public.controlled_drug_dispensing
  WHERE patient_name IS NOT NULL 
    AND patient_name != ''
    AND patient_user_id IS NULL;
  
  -- Migrate prescriber_name to prescriber_user_id
  -- Try to match by name in profiles (clinicians)
  UPDATE public.controlled_drug_dispensing cdd
  SET prescriber_user_id = (
    SELECT p.user_id
    FROM public.profiles p
    JOIN public.user_roles ur ON p.user_id = ur.user_id
    WHERE LOWER(TRIM(CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')))) = LOWER(TRIM(cdd.prescriber_name))
      AND ur.role = 'clinician'
    LIMIT 1
  )
  WHERE cdd.prescriber_name IS NOT NULL 
    AND cdd.prescriber_name != ''
    AND cdd.prescriber_user_id IS NULL;
  
  GET DIAGNOSTICS v_prescriber_matched = ROW_COUNT;
  
  -- Count unmatched prescribers
  SELECT COUNT(*) INTO v_prescriber_unmatched
  FROM public.controlled_drug_dispensing
  WHERE prescriber_name IS NOT NULL 
    AND prescriber_name != ''
    AND prescriber_user_id IS NULL;
  
  -- Migrate prescription_number to prescription_id
  UPDATE public.controlled_drug_dispensing cdd
  SET prescription_id = (
    SELECT p.id
    FROM public.prescriptions p
    WHERE p.prescription_number = cdd.prescription_number
    LIMIT 1
  )
  WHERE cdd.prescription_number IS NOT NULL 
    AND cdd.prescription_number != ''
    AND cdd.prescription_id IS NULL;
  
  GET DIAGNOSTICS v_prescription_matched = ROW_COUNT;
  
  -- Count unmatched prescriptions
  SELECT COUNT(*) INTO v_prescription_unmatched
  FROM public.controlled_drug_dispensing
  WHERE prescription_number IS NOT NULL 
    AND prescription_number != ''
    AND prescription_id IS NULL;
  
  RETURN QUERY SELECT 
    v_patient_matched,
    v_prescriber_matched,
    v_prescription_matched,
    v_patient_unmatched,
    v_prescriber_unmatched,
    v_prescription_unmatched;
END;
$$;

-- ============================================================
-- Step 3: Create backward compatibility view
-- ============================================================

CREATE OR REPLACE VIEW public.controlled_drug_dispensing_full AS
SELECT 
  cdd.id,
  cdd.controlled_drug_id,
  -- Patient details from join
  cdd.patient_user_id,
  CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) AS patient_name,
  cdd.patient_id AS patient_id_text, -- Keep original for reference
  -- Prescriber details from join
  cdd.prescriber_user_id,
  CONCAT(pr.first_name, ' ', COALESCE(pr.last_name, '')) AS prescriber_name,
  cdd.prescriber_dea,
  -- Prescription details from join
  cdd.prescription_id,
  pres.prescription_number,
  cdd.quantity_dispensed,
  cdd.quantity_remaining,
  cdd.dispensing_pharmacist_id,
  cdd.witness_pharmacist_id,
  cdd.dispensed_at,
  cdd.notes,
  cdd.created_at
FROM public.controlled_drug_dispensing cdd
LEFT JOIN public.profiles p ON cdd.patient_user_id = p.user_id
LEFT JOIN public.profiles pr ON cdd.prescriber_user_id = pr.user_id
LEFT JOIN public.prescriptions pres ON cdd.prescription_id = pres.id;

-- Grant access (restricted to pharmacists and admins)
-- RLS will be enforced through underlying table

-- ============================================================
-- Step 4: Remove TEXT columns (commented out - run after migration verified)
-- ============================================================

-- ALTER TABLE public.controlled_drug_dispensing DROP COLUMN IF EXISTS patient_name;
-- ALTER TABLE public.controlled_drug_dispensing DROP COLUMN IF EXISTS prescriber_name;
-- ALTER TABLE public.controlled_drug_dispensing DROP COLUMN IF EXISTS prescription_number;

-- Add comments
COMMENT ON COLUMN public.controlled_drug_dispensing.patient_user_id IS 
  'References patient user. Use join to get patient name. Part of 3NF compliance.';

COMMENT ON COLUMN public.controlled_drug_dispensing.prescriber_user_id IS 
  'References prescriber user. Use join to get prescriber name. Part of 3NF compliance.';

COMMENT ON COLUMN public.controlled_drug_dispensing.prescription_id IS 
  'References prescription. Use join to get prescription number. Part of 3NF compliance.';
