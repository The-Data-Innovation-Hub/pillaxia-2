-- Phase 3: Normalize 2NF and 3NF Violations
-- This migration removes redundant data that can be derived from foreign key relationships
-- and creates views for backward compatibility.

-- ============================================================
-- PART 1: Normalize medications table (2NF violation)
-- Remove medication details that should come from medication_catalog
-- ============================================================

-- First, ensure all medications have a medication_catalog_id
-- Create catalog entries for medications without one
INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
SELECT DISTINCT
  m.name,
  m.generic_name,
  m.dosage,
  COALESCE(m.dosage_unit, 'mg'),
  COALESCE(m.form, 'tablet')
FROM public.medications m
WHERE m.medication_catalog_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.medication_catalog mc
    WHERE LOWER(mc.name) = LOWER(m.name)
      AND mc.dosage = m.dosage
      AND mc.form = COALESCE(m.form, 'tablet')
  )
ON CONFLICT DO NOTHING;

-- Update medications to link to catalog
UPDATE public.medications m
SET medication_catalog_id = mc.id
FROM public.medication_catalog mc
WHERE m.medication_catalog_id IS NULL
  AND LOWER(mc.name) = LOWER(m.name)
  AND mc.dosage = m.dosage
  AND mc.form = COALESCE(m.form, 'tablet');

-- Create backup view with original data before dropping columns
CREATE OR REPLACE VIEW public.medications_full AS
SELECT
  m.id,
  m.user_id,
  m.medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.dosage_unit,
  mc.form,
  m.instructions,
  m.prescriber,
  m.pharmacy,
  m.refills_remaining,
  m.refills_authorized,
  m.is_active,
  m.prescription_status,
  m.start_date,
  m.end_date,
  m.created_at,
  m.updated_at,
  m.prescriber_user_id,
  m.pharmacy_id
FROM public.medications m
LEFT JOIN public.medication_catalog mc ON m.medication_catalog_id = mc.id;

-- Drop redundant columns from medications
ALTER TABLE public.medications
  DROP COLUMN IF EXISTS name CASCADE,
  DROP COLUMN IF EXISTS dosage CASCADE,
  DROP COLUMN IF EXISTS dosage_unit CASCADE,
  DROP COLUMN IF EXISTS form CASCADE,
  DROP COLUMN IF EXISTS generic_name CASCADE;

-- ============================================================
-- PART 2: Normalize prescriptions table (2NF violation)
-- ============================================================

-- Ensure all prescriptions have medication_catalog_id
INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
SELECT DISTINCT
  p.medication_name,
  p.generic_name,
  p.dosage,
  COALESCE(p.dosage_unit, 'mg'),
  COALESCE(p.form, 'tablet')
FROM public.prescriptions p
WHERE p.medication_catalog_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.medication_catalog mc
    WHERE LOWER(mc.name) = LOWER(p.medication_name)
      AND mc.dosage = p.dosage
      AND mc.form = COALESCE(p.form, 'tablet')
  )
ON CONFLICT DO NOTHING;

-- Update prescriptions to link to catalog
UPDATE public.prescriptions p
SET medication_catalog_id = mc.id
FROM public.medication_catalog mc
WHERE p.medication_catalog_id IS NULL
  AND LOWER(mc.name) = LOWER(p.medication_name)
  AND mc.dosage = p.dosage
  AND mc.form = COALESCE(p.form, 'tablet');

-- Create backup view
CREATE OR REPLACE VIEW public.prescriptions_full AS
SELECT
  p.id,
  p.patient_user_id,
  p.clinician_user_id,
  p.prescription_number,
  p.medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.dosage_unit,
  mc.form,
  p.quantity,
  p.refills,
  p.instructions,
  p.status,
  p.date_written,
  p.date_filled,
  p.expiration_date,
  p.pharmacy_id,
  p.pharmacy_notes,
  p.clinician_notes,
  p.created_at,
  p.updated_at
FROM public.prescriptions p
LEFT JOIN public.medication_catalog mc ON p.medication_catalog_id = mc.id;

-- Drop redundant columns from prescriptions
ALTER TABLE public.prescriptions
  DROP COLUMN IF EXISTS medication_name CASCADE,
  DROP COLUMN IF EXISTS dosage CASCADE,
  DROP COLUMN IF EXISTS dosage_unit CASCADE,
  DROP COLUMN IF EXISTS form CASCADE,
  DROP COLUMN IF EXISTS generic_name CASCADE;

-- ============================================================
-- PART 3: Normalize drug_transfers table (3NF violation)
-- ============================================================

-- Ensure all drug_transfers have medication_catalog_id
INSERT INTO public.medication_catalog (name, generic_name, dosage, form)
SELECT DISTINCT
  dt.drug_name,
  dt.generic_name,
  dt.dosage,
  COALESCE(dt.form, 'tablet')
FROM public.drug_transfers dt
WHERE dt.medication_catalog_id IS NULL
  AND dt.drug_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.medication_catalog mc
    WHERE LOWER(mc.name) = LOWER(dt.drug_name)
      AND mc.dosage = dt.dosage
      AND mc.form = COALESCE(dt.form, 'tablet')
  )
ON CONFLICT DO NOTHING;

-- Update drug_transfers to link to catalog
UPDATE public.drug_transfers dt
SET medication_catalog_id = mc.id
FROM public.medication_catalog mc
WHERE dt.medication_catalog_id IS NULL
  AND LOWER(mc.name) = LOWER(dt.drug_name)
  AND mc.dosage = dt.dosage
  AND mc.form = COALESCE(dt.form, 'tablet');

-- Create backup view
CREATE OR REPLACE VIEW public.drug_transfers_full AS
SELECT
  dt.id,
  dt.source_pharmacy_id,
  dt.destination_pharmacy_id,
  dt.medication_catalog_id,
  mc.name AS drug_name,
  mc.generic_name,
  mc.dosage,
  mc.form,
  dt.quantity,
  dt.status,
  dt.requested_by,
  dt.approved_by,
  dt.completed_by,
  dt.requested_at,
  dt.approved_at,
  dt.completed_at,
  dt.notes,
  dt.created_at,
  dt.updated_at
FROM public.drug_transfers dt
LEFT JOIN public.medication_catalog mc ON dt.medication_catalog_id = mc.id;

-- Drop redundant columns from drug_transfers
ALTER TABLE public.drug_transfers
  DROP COLUMN IF EXISTS drug_name CASCADE,
  DROP COLUMN IF EXISTS generic_name CASCADE,
  DROP COLUMN IF EXISTS dosage CASCADE,
  DROP COLUMN IF EXISTS form CASCADE;

-- ============================================================
-- PART 4: Normalize medication_availability table (3NF violation)
-- ============================================================

-- Ensure all medication_availability have medication_catalog_id
INSERT INTO public.medication_catalog (name, generic_name, dosage, form)
SELECT DISTINCT
  ma.medication_name,
  ma.generic_name,
  ma.dosage,
  COALESCE(ma.form, 'tablet')
FROM public.medication_availability ma
WHERE ma.medication_catalog_id IS NULL
  AND ma.medication_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.medication_catalog mc
    WHERE LOWER(mc.name) = LOWER(ma.medication_name)
      AND COALESCE(mc.dosage, '') = COALESCE(ma.dosage, '')
      AND mc.form = COALESCE(ma.form, 'tablet')
  )
ON CONFLICT DO NOTHING;

-- Update medication_availability to link to catalog
UPDATE public.medication_availability ma
SET medication_catalog_id = mc.id
FROM public.medication_catalog mc
WHERE ma.medication_catalog_id IS NULL
  AND LOWER(mc.name) = LOWER(ma.medication_name)
  AND COALESCE(mc.dosage, '') = COALESCE(ma.dosage, '')
  AND mc.form = COALESCE(ma.form, 'tablet');

-- Create backup view
CREATE OR REPLACE VIEW public.medication_availability_full AS
SELECT
  ma.id,
  ma.pharmacy_id,
  ma.medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.form,
  ma.quantity_in_stock,
  ma.low_stock_threshold,
  ma.is_available,
  ma.last_restocked_at,
  ma.created_at,
  ma.updated_at
FROM public.medication_availability ma
LEFT JOIN public.medication_catalog mc ON ma.medication_catalog_id = mc.id;

-- Drop redundant columns from medication_availability
ALTER TABLE public.medication_availability
  DROP COLUMN IF EXISTS medication_name CASCADE,
  DROP COLUMN IF EXISTS generic_name CASCADE,
  DROP COLUMN IF EXISTS dosage CASCADE,
  DROP COLUMN IF EXISTS form CASCADE;

-- ============================================================
-- PART 5: Normalize medication_availability_alerts table
-- ============================================================

-- Ensure all alerts have medication_catalog_id
UPDATE public.medication_availability_alerts maa
SET medication_catalog_id = ma.medication_catalog_id
FROM public.medication_availability ma
WHERE maa.availability_id = ma.id
  AND maa.medication_catalog_id IS NULL;

-- Create backup view
CREATE OR REPLACE VIEW public.medication_availability_alerts_full AS
SELECT
  maa.id,
  maa.availability_id,
  maa.medication_catalog_id,
  mc.name AS medication_name,
  maa.pharmacy_id,
  maa.alert_type,
  maa.is_resolved,
  maa.resolved_at,
  maa.created_at,
  maa.updated_at
FROM public.medication_availability_alerts maa
LEFT JOIN public.medication_catalog mc ON maa.medication_catalog_id = mc.id;

-- Drop redundant columns
ALTER TABLE public.medication_availability_alerts
  DROP COLUMN IF EXISTS medication_name CASCADE;

-- ============================================================
-- PART 6: Normalize controlled_drug_dispensing table (3NF violation)
-- Remove person names that should come from profiles
-- ============================================================

-- Create backup view with names
CREATE OR REPLACE VIEW public.controlled_drug_dispensing_full AS
SELECT
  cdd.id,
  cdd.prescription_id,
  cdd.patient_user_id,
  pp.first_name || ' ' || pp.last_name AS patient_name,
  cdd.patient_id,
  cdd.prescriber_user_id,
  cp.first_name || ' ' || cp.last_name AS prescriber_name,
  cp.license_number AS prescriber_dea,
  cdd.dispenser_user_id,
  cdd.quantity_dispensed,
  cdd.quantity_remaining,
  cdd.dispensed_at,
  cdd.form_dea_222_number,
  cdd.verified_by,
  cdd.verified_at,
  cdd.notes,
  cdd.created_at,
  cdd.updated_at
FROM public.controlled_drug_dispensing cdd
LEFT JOIN public.profiles pp ON cdd.patient_user_id = pp.user_id
LEFT JOIN public.profiles cp ON cdd.prescriber_user_id = cp.user_id;

-- Drop redundant name columns
ALTER TABLE public.controlled_drug_dispensing
  DROP COLUMN IF EXISTS patient_name CASCADE,
  DROP COLUMN IF EXISTS prescriber_name CASCADE,
  DROP COLUMN IF EXISTS prescriber_dea CASCADE;

-- ============================================================
-- PART 7: Normalize post_call_summaries (prescriptions as JSONB)
-- Create junction table for prescriptions
-- ============================================================

-- Create junction table
CREATE TABLE IF NOT EXISTS public.post_call_summary_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_call_summary_id uuid NOT NULL REFERENCES public.post_call_summaries(id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (post_call_summary_id, prescription_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_post_call_summary_prescriptions_summary
  ON public.post_call_summary_prescriptions(post_call_summary_id);

CREATE INDEX IF NOT EXISTS idx_post_call_summary_prescriptions_prescription
  ON public.post_call_summary_prescriptions(prescription_id);

-- Note: Data migration for JSONB prescriptions would require application-level logic
-- to parse the JSONB and create prescription records. This should be done separately.

-- Create view for backward compatibility (preserves JSONB for now)
CREATE OR REPLACE VIEW public.post_call_summaries_full AS
SELECT
  pcs.*,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'prescription_number', p.prescription_number,
        'medication_catalog_id', p.medication_catalog_id,
        'quantity', p.quantity,
        'refills', p.refills,
        'status', p.status
      )
    ) FILTER (WHERE p.id IS NOT NULL),
    '[]'::jsonb
  ) AS prescriptions_from_junction
FROM public.post_call_summaries pcs
LEFT JOIN public.post_call_summary_prescriptions pcsp ON pcs.id = pcsp.post_call_summary_id
LEFT JOIN public.prescriptions p ON pcsp.prescription_id = p.id
GROUP BY pcs.id;

-- ============================================================
-- PART 8: Update triggers to use catalog references
-- ============================================================

-- Update auto_link_alert_catalog trigger to not set medication_name
CREATE OR REPLACE FUNCTION public.auto_link_alert_catalog() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Link to medication_catalog if provided by name (for backward compatibility)
  -- New code should pass medication_catalog_id directly
  IF NEW.medication_catalog_id IS NULL THEN
    -- This function is now deprecated - applications should provide catalog_id directly
    RAISE NOTICE 'Auto-linking medication by name is deprecated. Please provide medication_catalog_id directly.';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Success Message
-- ============================================================

SELECT 'Phase 3 migration completed: Normalized 2NF and 3NF violations (removed redundant data)' AS status;
