-- ============================================================
-- PHASE 2: Fix medication_availability table - Add catalog FK, migrate data
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Add medication_catalog_id FK column
-- ============================================================

ALTER TABLE public.medication_availability
  ADD COLUMN IF NOT EXISTS medication_catalog_id UUID REFERENCES public.medication_catalog(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_medication_availability_catalog_id ON public.medication_availability(medication_catalog_id);

-- ============================================================
-- Step 2: Create function to migrate existing data to catalog
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_medication_availability_to_catalog()
RETURNS TABLE(
  catalog_entries_created INTEGER,
  availability_records_migrated INTEGER,
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
  v_catalog_id UUID;
BEGIN
  -- First, create catalog entries from unique medication combinations
  INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
  SELECT DISTINCT
    medication_name,
    generic_name,
    COALESCE(dosage, ''),
    'mg', -- Default, adjust if needed
    COALESCE(form, 'tablet')
  FROM public.medication_availability
  WHERE medication_catalog_id IS NULL
    AND medication_name IS NOT NULL
    AND medication_name != ''
  ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;
  
  GET DIAGNOSTICS v_catalog_created = ROW_COUNT;
  
  -- Now link availability records to catalog entries
  UPDATE public.medication_availability ma
  SET medication_catalog_id = (
    SELECT mc.id
    FROM public.medication_catalog mc
    WHERE mc.name = ma.medication_name
      AND mc.dosage = COALESCE(ma.dosage, '')
      AND mc.form = COALESCE(ma.form, 'tablet')
    LIMIT 1
  )
  WHERE ma.medication_catalog_id IS NULL
    AND ma.medication_name IS NOT NULL
    AND ma.medication_name != '';
  
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  
  -- Count unmatched records
  SELECT COUNT(*) INTO v_unmatched
  FROM public.medication_availability
  WHERE medication_catalog_id IS NULL
    AND medication_name IS NOT NULL
    AND medication_name != '';
  
  RETURN QUERY SELECT 
    v_catalog_created,
    v_migrated,
    v_unmatched;
END;
$$;

-- ============================================================
-- Step 3: Create backward compatibility view
-- ============================================================

CREATE OR REPLACE VIEW public.medication_availability_with_details AS
SELECT 
  ma.id,
  ma.pharmacy_id,
  -- Medication details from catalog
  COALESCE(mc.name, ma.medication_name) AS medication_name,
  COALESCE(mc.generic_name, ma.generic_name) AS generic_name,
  COALESCE(mc.dosage, ma.dosage) AS dosage,
  COALESCE(mc.form, ma.form) AS form,
  ma.is_available,
  ma.quantity_available,
  ma.price_naira,
  ma.notes,
  ma.last_updated_by,
  ma.created_at,
  ma.updated_at
FROM public.medication_availability ma
LEFT JOIN public.medication_catalog mc ON ma.medication_catalog_id = mc.id;

-- Grant access
GRANT SELECT ON public.medication_availability_with_details TO authenticated;

-- ============================================================
-- Step 4: Remove TEXT columns (commented out - run after migration verified)
-- ============================================================

-- ALTER TABLE public.medication_availability DROP COLUMN IF EXISTS medication_name;
-- ALTER TABLE public.medication_availability DROP COLUMN IF EXISTS generic_name;
-- ALTER TABLE public.medication_availability DROP COLUMN IF EXISTS dosage;
-- ALTER TABLE public.medication_availability DROP COLUMN IF EXISTS form;

-- Add comments
COMMENT ON COLUMN public.medication_availability.medication_catalog_id IS 
  'References medication_catalog for normalized medication information. Part of 3NF compliance.';
