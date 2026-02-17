-- Phase 2: Normalize 1NF Violations
-- This migration converts array columns to proper junction tables
-- to eliminate repeating groups and improve queryability.

-- ============================================================
-- PART 1: Create Junction Tables for drug_recalls arrays
-- ============================================================

-- Create drug_recall_lot_numbers junction table
CREATE TABLE IF NOT EXISTS public.drug_recall_lot_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_recall_id uuid NOT NULL REFERENCES public.drug_recalls(id) ON DELETE CASCADE,
  lot_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (drug_recall_id, lot_number)
);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_drug_recall_lot_numbers_recall_id
  ON public.drug_recall_lot_numbers(drug_recall_id);

CREATE INDEX IF NOT EXISTS idx_drug_recall_lot_numbers_lot_number
  ON public.drug_recall_lot_numbers(lot_number);

-- Create drug_recall_ndc_numbers junction table
CREATE TABLE IF NOT EXISTS public.drug_recall_ndc_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_recall_id uuid NOT NULL REFERENCES public.drug_recalls(id) ON DELETE CASCADE,
  ndc_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (drug_recall_id, ndc_number)
);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_drug_recall_ndc_numbers_recall_id
  ON public.drug_recall_ndc_numbers(drug_recall_id);

CREATE INDEX IF NOT EXISTS idx_drug_recall_ndc_numbers_ndc_number
  ON public.drug_recall_ndc_numbers(ndc_number);

-- ============================================================
-- PART 2: Migrate Data from drug_recalls arrays
-- ============================================================

-- Migrate lot_numbers array data to junction table
INSERT INTO public.drug_recall_lot_numbers (drug_recall_id, lot_number)
SELECT
  dr.id,
  UNNEST(dr.lot_numbers) AS lot_number
FROM public.drug_recalls dr
WHERE dr.lot_numbers IS NOT NULL
  AND array_length(dr.lot_numbers, 1) > 0
ON CONFLICT (drug_recall_id, lot_number) DO NOTHING;

-- Migrate affected_ndc_numbers array data to junction table
INSERT INTO public.drug_recall_ndc_numbers (drug_recall_id, ndc_number)
SELECT
  dr.id,
  UNNEST(dr.affected_ndc_numbers) AS ndc_number
FROM public.drug_recalls dr
WHERE dr.affected_ndc_numbers IS NOT NULL
  AND array_length(dr.affected_ndc_numbers, 1) > 0
ON CONFLICT (drug_recall_id, ndc_number) DO NOTHING;

-- ============================================================
-- PART 3: Create Backward-Compatible Views
-- ============================================================

-- Create view that provides array format for backward compatibility
CREATE OR REPLACE VIEW public.drug_recalls_with_arrays AS
SELECT
  dr.*,
  COALESCE(
    ARRAY_AGG(DISTINCT drln.lot_number) FILTER (WHERE drln.lot_number IS NOT NULL),
    '{}'::text[]
  ) AS lot_numbers_view,
  COALESCE(
    ARRAY_AGG(DISTINCT drnn.ndc_number) FILTER (WHERE drnn.ndc_number IS NOT NULL),
    '{}'::text[]
  ) AS ndc_numbers_view
FROM public.drug_recalls dr
LEFT JOIN public.drug_recall_lot_numbers drln ON dr.id = drln.drug_recall_id
LEFT JOIN public.drug_recall_ndc_numbers drnn ON dr.id = drnn.drug_recall_id
GROUP BY dr.id;

-- ============================================================
-- PART 4: Drop Original Array Columns
-- ============================================================

-- Drop lot_numbers column from drug_recalls
ALTER TABLE public.drug_recalls
  DROP COLUMN IF EXISTS lot_numbers;

-- Drop affected_ndc_numbers column from drug_recalls
ALTER TABLE public.drug_recalls
  DROP COLUMN IF EXISTS affected_ndc_numbers;

-- ============================================================
-- PART 5: Normalize medication_schedules.days_of_week array
-- ============================================================

-- Create medication_schedule_days junction table
CREATE TABLE IF NOT EXISTS public.medication_schedule_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_id, day_of_week)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_medication_schedule_days_schedule_id
  ON public.medication_schedule_days(schedule_id);

CREATE INDEX IF NOT EXISTS idx_medication_schedule_days_day_of_week
  ON public.medication_schedule_days(day_of_week);

-- ============================================================
-- PART 6: Migrate medication_schedules days_of_week data
-- ============================================================

-- Migrate days_of_week array data to junction table
INSERT INTO public.medication_schedule_days (schedule_id, day_of_week)
SELECT
  ms.id,
  UNNEST(ms.days_of_week) AS day_of_week
FROM public.medication_schedules ms
WHERE ms.days_of_week IS NOT NULL
  AND array_length(ms.days_of_week, 1) > 0
ON CONFLICT (schedule_id, day_of_week) DO NOTHING;

-- ============================================================
-- PART 7: Create Backward-Compatible View for medication_schedules
-- ============================================================

-- Create view that provides array format for backward compatibility
CREATE OR REPLACE VIEW public.medication_schedules_with_days_array AS
SELECT
  ms.*,
  COALESCE(
    ARRAY_AGG(msd.day_of_week ORDER BY msd.day_of_week) FILTER (WHERE msd.day_of_week IS NOT NULL),
    ARRAY[0, 1, 2, 3, 4, 5, 6]
  ) AS days_of_week_view
FROM public.medication_schedules ms
LEFT JOIN public.medication_schedule_days msd ON ms.id = msd.schedule_id
GROUP BY ms.id;

-- ============================================================
-- PART 8: Drop Original days_of_week Array Column
-- ============================================================

-- Drop days_of_week column from medication_schedules
ALTER TABLE public.medication_schedules
  DROP COLUMN IF EXISTS days_of_week;

-- ============================================================
-- PART 9: Add Helper Functions for Common Operations
-- ============================================================

-- Function to add a lot number to a drug recall
CREATE OR REPLACE FUNCTION public.add_drug_recall_lot_number(
  p_recall_id uuid,
  p_lot_number text
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.drug_recall_lot_numbers (drug_recall_id, lot_number)
  VALUES (p_recall_id, p_lot_number)
  ON CONFLICT (drug_recall_id, lot_number) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add an NDC number to a drug recall
CREATE OR REPLACE FUNCTION public.add_drug_recall_ndc_number(
  p_recall_id uuid,
  p_ndc_number text
) RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.drug_recall_ndc_numbers (drug_recall_id, ndc_number)
  VALUES (p_recall_id, p_ndc_number)
  ON CONFLICT (drug_recall_id, ndc_number) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set days of week for a medication schedule
CREATE OR REPLACE FUNCTION public.set_medication_schedule_days(
  p_schedule_id uuid,
  p_days integer[]
) RETURNS void AS $$
BEGIN
  -- Delete existing days
  DELETE FROM public.medication_schedule_days
  WHERE schedule_id = p_schedule_id;

  -- Insert new days
  INSERT INTO public.medication_schedule_days (schedule_id, day_of_week)
  SELECT p_schedule_id, UNNEST(p_days)
  ON CONFLICT (schedule_id, day_of_week) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Success Message
-- ============================================================

SELECT 'Phase 2 migration completed: Normalized 1NF violations (array columns converted to junction tables)' AS status;
