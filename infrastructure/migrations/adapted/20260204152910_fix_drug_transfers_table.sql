-- ============================================================
-- PHASE 2: Fix drug_transfers table - Add catalog FK, migrate data
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Add medication_catalog_id FK column
-- ============================================================

ALTER TABLE public.drug_transfers
  ADD COLUMN IF NOT EXISTS medication_catalog_id UUID REFERENCES public.medication_catalog(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_catalog_id ON public.drug_transfers(medication_catalog_id);

-- ============================================================
-- Step 2: Create function to migrate existing data to catalog
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_drug_transfers_to_catalog()
RETURNS TABLE(
  catalog_entries_created INTEGER,
  transfers_migrated INTEGER,
  unmatched_records INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog_created INTEGER := 0;
  v_migrated INTEGER := 0;
  v_unmatched INTEGER := 0;
BEGIN
  -- First, create catalog entries from unique medication combinations
  INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
  SELECT DISTINCT
    drug_name,
    generic_name,
    COALESCE(dosage, ''),
    'mg', -- Default
    COALESCE(form, 'tablet')
  FROM public.drug_transfers
  WHERE medication_catalog_id IS NULL
    AND drug_name IS NOT NULL
    AND drug_name != ''
  ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;
  
  GET DIAGNOSTICS v_catalog_created = ROW_COUNT;
  
  -- Now link transfer records to catalog entries
  UPDATE public.drug_transfers dt
  SET medication_catalog_id = (
    SELECT mc.id
    FROM public.medication_catalog mc
    WHERE mc.name = dt.drug_name
      AND mc.dosage = COALESCE(dt.dosage, '')
      AND mc.form = COALESCE(dt.form, 'tablet')
    LIMIT 1
  )
  WHERE dt.medication_catalog_id IS NULL
    AND dt.drug_name IS NOT NULL
    AND dt.drug_name != '';
  
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  
  -- Count unmatched records
  SELECT COUNT(*) INTO v_unmatched
  FROM public.drug_transfers
  WHERE medication_catalog_id IS NULL
    AND drug_name IS NOT NULL
    AND drug_name != '';
  
  RETURN QUERY SELECT 
    v_catalog_created,
    v_migrated,
    v_unmatched;
END;
$$;

-- ============================================================
-- Step 3: Create backward compatibility view
-- ============================================================

CREATE OR REPLACE VIEW public.drug_transfers_full AS
SELECT 
  dt.id,
  dt.source_pharmacy_id,
  dt.destination_pharmacy_id,
  -- Medication details from catalog
  COALESCE(mc.name, dt.drug_name) AS drug_name,
  COALESCE(mc.generic_name, dt.generic_name) AS generic_name,
  COALESCE(mc.dosage, dt.dosage) AS dosage,
  COALESCE(mc.form, dt.form) AS form,
  dt.quantity,
  dt.lot_number,
  dt.expiry_date,
  dt.reason,
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

-- Grant access (RLS enforced through underlying table)

-- ============================================================
-- Step 4: Remove TEXT columns (commented out - run after migration verified)
-- ============================================================

-- ALTER TABLE public.drug_transfers DROP COLUMN IF EXISTS drug_name;
-- ALTER TABLE public.drug_transfers DROP COLUMN IF EXISTS generic_name;
-- ALTER TABLE public.drug_transfers DROP COLUMN IF EXISTS dosage;
-- ALTER TABLE public.drug_transfers DROP COLUMN IF EXISTS form;

-- Add comments
COMMENT ON COLUMN public.drug_transfers.medication_catalog_id IS 
  'References medication_catalog for normalized medication information. Part of 3NF compliance.';
