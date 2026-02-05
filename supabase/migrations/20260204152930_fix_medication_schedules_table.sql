-- ============================================================
-- PHASE 2: Fix medication_schedules table - Remove redundant user_id
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Create view with user_id from medications join before removing column
-- ============================================================

CREATE OR REPLACE VIEW public.medication_schedules_with_user AS
SELECT 
  ms.id,
  ms.medication_id,
  -- Derive user_id from medications table
  m.user_id,
  ms.time_of_day,
  ms.days_of_week,
  ms.quantity,
  ms.with_food,
  ms.is_active,
  ms.created_at
FROM public.medication_schedules ms
JOIN public.medications m ON ms.medication_id = m.id;

-- Grant access
GRANT SELECT ON public.medication_schedules_with_user TO authenticated;

-- ============================================================
-- Step 2: Verify data integrity before removing column
-- Ensure all schedules have matching medications
-- ============================================================

-- Create function to check for orphaned schedules
CREATE OR REPLACE FUNCTION public.check_medication_schedules_integrity()
RETURNS TABLE(
  orphaned_schedules INTEGER,
  schedules_with_mismatched_user_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orphaned INTEGER := 0;
  v_mismatched INTEGER := 0;
BEGIN
  -- Count schedules without matching medications
  SELECT COUNT(*) INTO v_orphaned
  FROM public.medication_schedules ms
  WHERE NOT EXISTS (
    SELECT 1 FROM public.medications m WHERE m.id = ms.medication_id
  );
  
  -- Count schedules where user_id doesn't match medication's user_id
  SELECT COUNT(*) INTO v_mismatched
  FROM public.medication_schedules ms
  JOIN public.medications m ON ms.medication_id = m.id
  WHERE ms.user_id != m.user_id;
  
  RETURN QUERY SELECT v_orphaned, v_mismatched;
END;
$$;

-- ============================================================
-- Step 3: Remove redundant user_id column
-- ============================================================

ALTER TABLE public.medication_schedules DROP COLUMN IF EXISTS user_id;

-- Update RLS policies to use derived user_id
-- Note: Existing policies reference user_id directly, so we need to update them

-- Drop existing policies that reference user_id
DROP POLICY IF EXISTS "Users can view own schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Users can insert own schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Users can update own schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Users can delete own schedules" ON public.medication_schedules;
DROP POLICY IF EXISTS "Clinicians can view assigned patient schedules" ON public.medication_schedules;

-- Recreate policies using derived user_id from medications
CREATE POLICY "Users can view own schedules"
  ON public.medication_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_schedules.medication_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own schedules"
  ON public.medication_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_schedules.medication_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own schedules"
  ON public.medication_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_schedules.medication_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own schedules"
  ON public.medication_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_schedules.medication_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Clinicians can view assigned patient schedules"
  ON public.medication_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_schedules.medication_id
        AND is_clinician_assigned(m.user_id, auth.uid())
    )
  );

-- Add comments
COMMENT ON VIEW public.medication_schedules_with_user IS 
  'Medication schedules with user_id derived from medications table. Part of 3NF compliance.';

COMMENT ON TABLE public.medication_schedules IS 
  'Medication schedules. user_id is derived from medications.user_id via medication_id. Use medication_schedules_with_user view. Part of 3NF compliance.';
