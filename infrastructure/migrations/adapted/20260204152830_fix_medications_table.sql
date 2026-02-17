-- ============================================================
-- PHASE 2: Fix medications table - Add FKs, migrate data, remove TEXT columns
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Add new FK columns
-- ============================================================

-- Add prescriber_user_id FK column
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS prescriber_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add pharmacy_id FK column
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS pharmacy_id UUID REFERENCES public.pharmacy_locations(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_prescriber_user_id ON public.medications(prescriber_user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_pharmacy_id ON public.medications(pharmacy_id);

-- ============================================================
-- Step 2: Create function to migrate existing TEXT data to FKs
-- This will be called by a separate migration script
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_medications_text_to_fks()
RETURNS TABLE(
  migrated_count INTEGER,
  prescriber_matched INTEGER,
  pharmacy_matched INTEGER,
  prescriber_unmatched INTEGER,
  pharmacy_unmatched INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prescriber_matched INTEGER := 0;
  v_pharmacy_matched INTEGER := 0;
  v_prescriber_unmatched INTEGER := 0;
  v_pharmacy_unmatched INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  -- Migrate prescriber TEXT to prescriber_user_id
  -- Try to match by email first, then by name
  UPDATE public.medications m
  SET prescriber_user_id = (
    SELECT u.id
    FROM public.users u
    JOIN public.profiles p ON u.id = p.user_id
    WHERE (
      LOWER(TRIM(p.first_name || ' ' || COALESCE(p.last_name, ''))) = LOWER(TRIM(m.prescriber))
      OR u.email = m.prescriber
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = u.id AND ur.role = 'clinician'
    )
    LIMIT 1
  )
  WHERE m.prescriber IS NOT NULL 
    AND m.prescriber != ''
    AND m.prescriber_user_id IS NULL;
  
  GET DIAGNOSTICS v_prescriber_matched = ROW_COUNT;
  
  -- Count unmatched prescribers
  SELECT COUNT(*) INTO v_prescriber_unmatched
  FROM public.medications
  WHERE prescriber IS NOT NULL 
    AND prescriber != ''
    AND prescriber_user_id IS NULL;
  
  -- Migrate pharmacy TEXT to pharmacy_id
  -- Match by pharmacy name
  UPDATE public.medications m
  SET pharmacy_id = (
    SELECT pl.id
    FROM public.pharmacy_locations pl
    WHERE LOWER(TRIM(pl.name)) = LOWER(TRIM(m.pharmacy))
    LIMIT 1
  )
  WHERE m.pharmacy IS NOT NULL 
    AND m.pharmacy != ''
    AND m.pharmacy_id IS NULL;
  
  GET DIAGNOSTICS v_pharmacy_matched = ROW_COUNT;
  
  -- Count unmatched pharmacies
  SELECT COUNT(*) INTO v_pharmacy_unmatched
  FROM public.medications
  WHERE pharmacy IS NOT NULL 
    AND pharmacy != ''
    AND pharmacy_id IS NULL;
  
  SELECT COUNT(*) INTO v_total FROM public.medications;
  
  RETURN QUERY SELECT 
    v_total,
    v_prescriber_matched,
    v_pharmacy_matched,
    v_prescriber_unmatched,
    v_pharmacy_unmatched;
END;
$$;

-- ============================================================
-- Step 3: Create backward compatibility view
-- ============================================================

CREATE OR REPLACE VIEW public.medications_with_details AS
SELECT 
  m.id,
  m.user_id,
  m.name,
  m.dosage,
  m.dosage_unit,
  m.form,
  m.instructions,
  -- Prescriber details from join
  m.prescriber_user_id,
  CONCAT(p.first_name, ' ', COALESCE(p.last_name, '')) AS prescriber,
  -- Pharmacy details from join
  m.pharmacy_id,
  pl.name AS pharmacy,
  m.refills_remaining,
  m.is_active,
  m.start_date,
  m.end_date,
  m.created_at,
  m.updated_at
FROM public.medications m
LEFT JOIN public.profiles p ON m.prescriber_user_id = p.user_id
LEFT JOIN public.pharmacy_locations pl ON m.pharmacy_id = pl.id;

-- Grant access
GRANT SELECT ON public.medications_with_details TO authenticated;

-- ============================================================
-- Step 4: Remove TEXT columns (commented out - run after data migration verified)
-- ============================================================

-- ALTER TABLE public.medications DROP COLUMN IF EXISTS prescriber;
-- ALTER TABLE public.medications DROP COLUMN IF EXISTS pharmacy;

-- Add comments
COMMENT ON COLUMN public.medications.prescriber_user_id IS 
  'References clinician who prescribed. Use join to get prescriber name. Part of 3NF compliance.';

COMMENT ON COLUMN public.medications.pharmacy_id IS 
  'References pharmacy location. Use join to get pharmacy name. Part of 3NF compliance.';
