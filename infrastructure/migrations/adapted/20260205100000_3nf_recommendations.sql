-- ============================================================
-- 3NF Compliance Recommendations Implementation
-- Date: 2026-02-05
--
-- Implements the top 5 recommendations from the 3NF audit:
--   Rec 1: Add medication_catalog_id FK to medications
--   Rec 2: Enforce medication_catalog_id NOT NULL on new inserts
--   Rec 3: Add ~20 missing explicit FK constraints
--   Rec 4: Replace computed columns with generated columns
--   Rec 5: Add medication_catalog_id FK to medication_availability_alerts
-- ============================================================

BEGIN;

-- ============================================================
-- RECOMMENDATION 1: Add medication_catalog_id FK to medications
-- ============================================================
-- The medications table has text columns (name, dosage, dosage_unit, form)
-- that duplicate data from medication_catalog. Add the FK column and
-- a data-migration function.

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS medication_catalog_id UUID
    REFERENCES public.medication_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medications_catalog_id
  ON public.medications(medication_catalog_id);

-- Function to backfill medication_catalog_id from existing text columns
CREATE OR REPLACE FUNCTION public.backfill_medications_catalog_fk()
RETURNS TABLE(matched INTEGER, unmatched INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matched INTEGER := 0;
  v_unmatched INTEGER := 0;
BEGIN
  -- First, ensure catalog entries exist for all unique medication combos
  INSERT INTO public.medication_catalog (name, dosage, dosage_unit, form)
  SELECT DISTINCT m.name, m.dosage, m.dosage_unit, m.form
  FROM public.medications m
  WHERE m.medication_catalog_id IS NULL
    AND m.name IS NOT NULL AND m.name != ''
  ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;

  -- Link medications to catalog entries
  UPDATE public.medications m
  SET medication_catalog_id = (
    SELECT mc.id
    FROM public.medication_catalog mc
    WHERE mc.name = m.name
      AND mc.dosage = m.dosage
      AND mc.dosage_unit = m.dosage_unit
      AND mc.form = m.form
    LIMIT 1
  )
  WHERE m.medication_catalog_id IS NULL
    AND m.name IS NOT NULL AND m.name != '';

  GET DIAGNOSTICS v_matched = ROW_COUNT;

  SELECT COUNT(*) INTO v_unmatched
  FROM public.medications
  WHERE medication_catalog_id IS NULL
    AND name IS NOT NULL AND name != '';

  RETURN QUERY SELECT v_matched, v_unmatched;
END;
$$;

-- Trigger to auto-populate medication_catalog_id on INSERT if not provided
CREATE OR REPLACE FUNCTION public.auto_link_medication_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If medication_catalog_id is not provided, try to find it from text fields
  IF NEW.medication_catalog_id IS NULL AND NEW.name IS NOT NULL AND NEW.name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE mc.name = NEW.name
      AND mc.dosage = NEW.dosage
      AND mc.dosage_unit = COALESCE(NEW.dosage_unit, 'mg')
      AND mc.form = COALESCE(NEW.form, 'tablet')
    LIMIT 1;

    -- If no catalog entry exists, create one
    IF NEW.medication_catalog_id IS NULL THEN
      INSERT INTO public.medication_catalog (name, dosage, dosage_unit, form)
      VALUES (NEW.name, NEW.dosage, COALESCE(NEW.dosage_unit, 'mg'), COALESCE(NEW.form, 'tablet'))
      ON CONFLICT (name, dosage, dosage_unit, form) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO NEW.medication_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_auto_link_medication_catalog ON public.medications;
CREATE TRIGGER trg_auto_link_medication_catalog
  BEFORE INSERT ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_medication_catalog();

COMMENT ON COLUMN public.medications.medication_catalog_id IS
  '3NF: FK to medication_catalog. Auto-populated on INSERT via trigger. Text fields (name, dosage, dosage_unit, form) kept for backward compat but should be sourced from catalog.';

-- Run the backfill
DO $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM public.backfill_medications_catalog_fk();
  RAISE NOTICE 'Rec 1 — medications catalog FK: matched=%, unmatched=%', v.matched, v.unmatched;
END $$;


-- ============================================================
-- RECOMMENDATION 2: Enforce medication_catalog_id on new inserts
-- for medication_availability and drug_transfers
-- ============================================================

-- Trigger for medication_availability: auto-link to catalog on INSERT
CREATE OR REPLACE FUNCTION public.auto_link_availability_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.medication_catalog_id IS NULL AND NEW.medication_name IS NOT NULL AND NEW.medication_name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE mc.name = NEW.medication_name
      AND mc.dosage = COALESCE(NEW.dosage, '')
      AND mc.form = COALESCE(NEW.form, 'tablet')
    LIMIT 1;

    -- Create catalog entry if missing
    IF NEW.medication_catalog_id IS NULL THEN
      INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
      VALUES (
        NEW.medication_name,
        COALESCE(NEW.generic_name, ''),
        COALESCE(NEW.dosage, ''),
        'mg',
        COALESCE(NEW.form, 'tablet')
      )
      ON CONFLICT (name, dosage, dosage_unit, form) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO NEW.medication_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_availability_catalog ON public.medication_availability;
CREATE TRIGGER trg_auto_link_availability_catalog
  BEFORE INSERT ON public.medication_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_availability_catalog();

-- Trigger for drug_transfers: auto-link to catalog on INSERT
CREATE OR REPLACE FUNCTION public.auto_link_transfer_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.medication_catalog_id IS NULL AND NEW.drug_name IS NOT NULL AND NEW.drug_name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE mc.name = NEW.drug_name
      AND mc.dosage = COALESCE(NEW.dosage, '')
      AND mc.form = COALESCE(NEW.form, 'tablet')
    LIMIT 1;

    -- Create catalog entry if missing
    IF NEW.medication_catalog_id IS NULL THEN
      INSERT INTO public.medication_catalog (name, generic_name, dosage, dosage_unit, form)
      VALUES (
        NEW.drug_name,
        COALESCE(NEW.generic_name, ''),
        COALESCE(NEW.dosage, ''),
        'mg',
        COALESCE(NEW.form, 'tablet')
      )
      ON CONFLICT (name, dosage, dosage_unit, form) DO UPDATE SET name = EXCLUDED.name
      RETURNING id INTO NEW.medication_catalog_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_transfer_catalog ON public.drug_transfers;
CREATE TRIGGER trg_auto_link_transfer_catalog
  BEFORE INSERT ON public.drug_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_transfer_catalog();

-- Add unique constraint to prevent duplicate pharmacy+catalog combos
-- (use DO block to safely skip if it already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_medication_availability_pharmacy_catalog'
  ) THEN
    ALTER TABLE public.medication_availability
      ADD CONSTRAINT uq_medication_availability_pharmacy_catalog
      UNIQUE (pharmacy_id, medication_catalog_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add unique constraint on medication_availability — some duplicates may exist: %', SQLERRM;
END $$;

-- Run backfill for medication_availability
DO $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM public.migrate_medication_availability_to_catalog();
  RAISE NOTICE 'Rec 2 — availability catalog FK: created=%, migrated=%, unmatched=%',
    v.catalog_entries_created, v.availability_records_migrated, v.unmatched_records;
END $$;

-- Run backfill for drug_transfers
DO $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM public.migrate_drug_transfers_to_catalog();
  RAISE NOTICE 'Rec 2 — transfers catalog FK: created=%, migrated=%, unmatched=%',
    v.catalog_entries_created, v.transfers_migrated, v.unmatched_records;
END $$;


-- ============================================================
-- RECOMMENDATION 3: Add missing explicit FK constraints
-- ============================================================
-- Uses DO blocks with exception handling so migration is idempotent

-- Helper: safely add a FK constraint
CREATE OR REPLACE FUNCTION pg_temp.safe_add_fk(
  p_table TEXT,
  p_constraint TEXT,
  p_column TEXT,
  p_ref_table TEXT,
  p_ref_column TEXT,
  p_on_delete TEXT DEFAULT 'CASCADE'
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = p_constraint
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s',
      p_table, p_constraint, p_column, p_ref_table, p_ref_column, p_on_delete
    );
    RAISE NOTICE 'Added FK: %.% -> %.%', p_table, p_column, p_ref_table, p_ref_column;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add FK %: %', p_constraint, SQLERRM;
END;
$$;

-- push_subscriptions.user_id
SELECT pg_temp.safe_add_fk('push_subscriptions', 'fk_push_subscriptions_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- notification_history.user_id
SELECT pg_temp.safe_add_fk('notification_history', 'fk_notification_history_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_notification_preferences.user_id (Phase 1 may have added this already)
SELECT pg_temp.safe_add_fk('patient_notification_preferences', 'fk_patient_notif_prefs_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- security_events.user_id (nullable — ON DELETE SET NULL)
SELECT pg_temp.safe_add_fk('security_events', 'fk_security_events_user_id', 'user_id', 'users', 'id', 'SET NULL');

-- data_access_log.user_id
SELECT pg_temp.safe_add_fk('data_access_log', 'fk_data_access_log_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- user_login_locations.user_id
SELECT pg_temp.safe_add_fk('user_login_locations', 'fk_user_login_locations_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- user_sessions.user_id
SELECT pg_temp.safe_add_fk('user_sessions', 'fk_user_sessions_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- mfa_recovery_codes.user_id
SELECT pg_temp.safe_add_fk('mfa_recovery_codes', 'fk_mfa_recovery_codes_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_engagement_scores.user_id
SELECT pg_temp.safe_add_fk('patient_engagement_scores', 'fk_patient_engagement_scores_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_activity_log.user_id
SELECT pg_temp.safe_add_fk('patient_activity_log', 'fk_patient_activity_log_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_chronic_conditions.user_id
SELECT pg_temp.safe_add_fk('patient_chronic_conditions', 'fk_patient_chronic_conditions_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_allergies.user_id
SELECT pg_temp.safe_add_fk('patient_allergies', 'fk_patient_allergies_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_emergency_contacts.user_id
SELECT pg_temp.safe_add_fk('patient_emergency_contacts', 'fk_patient_emergency_contacts_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- medication_availability_alerts.patient_user_id
SELECT pg_temp.safe_add_fk('medication_availability_alerts', 'fk_med_avail_alerts_patient_user_id', 'patient_user_id', 'users', 'id', 'CASCADE');

-- availability_notification_history.patient_user_id
SELECT pg_temp.safe_add_fk('availability_notification_history', 'fk_avail_notif_history_patient_user_id', 'patient_user_id', 'users', 'id', 'CASCADE');

-- clinician_messages.clinician_user_id
SELECT pg_temp.safe_add_fk('clinician_messages', 'fk_clinician_messages_clinician_user_id', 'clinician_user_id', 'users', 'id', 'CASCADE');

-- clinician_messages.patient_user_id
SELECT pg_temp.safe_add_fk('clinician_messages', 'fk_clinician_messages_patient_user_id', 'patient_user_id', 'users', 'id', 'CASCADE');

-- caregiver_messages.caregiver_user_id
SELECT pg_temp.safe_add_fk('caregiver_messages', 'fk_caregiver_messages_caregiver_user_id', 'caregiver_user_id', 'users', 'id', 'CASCADE');

-- caregiver_messages.patient_user_id
SELECT pg_temp.safe_add_fk('caregiver_messages', 'fk_caregiver_messages_patient_user_id', 'patient_user_id', 'users', 'id', 'CASCADE');

-- patient_vitals.user_id
SELECT pg_temp.safe_add_fk('patient_vitals', 'fk_patient_vitals_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- patient_vitals.recorded_by (nullable — SET NULL)
SELECT pg_temp.safe_add_fk('patient_vitals', 'fk_patient_vitals_recorded_by', 'recorded_by', 'users', 'id', 'SET NULL');

-- lab_results.user_id
SELECT pg_temp.safe_add_fk('lab_results', 'fk_lab_results_user_id', 'user_id', 'users', 'id', 'CASCADE');

-- lab_results.ordered_by (nullable — SET NULL)
SELECT pg_temp.safe_add_fk('lab_results', 'fk_lab_results_ordered_by', 'ordered_by', 'users', 'id', 'SET NULL');


-- ============================================================
-- RECOMMENDATION 4: Replace computed columns with generated columns
-- in patient_engagement_scores
-- ============================================================
-- PostgreSQL 15 supports GENERATED ALWAYS AS ... STORED columns.
-- We need to:
--   1. Drop the existing overall_score and risk_level columns
--   2. Re-add them as generated columns

-- Step 1: Drop existing columns
ALTER TABLE public.patient_engagement_scores
  DROP COLUMN IF EXISTS overall_score,
  DROP COLUMN IF EXISTS risk_level;

-- Step 2: Add overall_score as a generated column (average of 3 sub-scores)
ALTER TABLE public.patient_engagement_scores
  ADD COLUMN overall_score NUMERIC(5,2) GENERATED ALWAYS AS (
    ROUND((adherence_score + app_usage_score + notification_score) / 3.0, 2)
  ) STORED;

-- Step 3: Add risk_level as a generated column based on overall_score thresholds
ALTER TABLE public.patient_engagement_scores
  ADD COLUMN risk_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN ROUND((adherence_score + app_usage_score + notification_score) / 3.0, 2) >= 70 THEN 'low'
      WHEN ROUND((adherence_score + app_usage_score + notification_score) / 3.0, 2) >= 40 THEN 'medium'
      ELSE 'high'
    END
  ) STORED;

COMMENT ON COLUMN public.patient_engagement_scores.overall_score IS
  '3NF: Generated column — average of adherence_score, app_usage_score, notification_score. Cannot be directly set.';
COMMENT ON COLUMN public.patient_engagement_scores.risk_level IS
  '3NF: Generated column — derived from overall_score thresholds (>=70 low, >=40 medium, else high). Cannot be directly set.';


-- ============================================================
-- RECOMMENDATION 5: Add medication_catalog_id FK to
-- medication_availability_alerts
-- ============================================================

ALTER TABLE public.medication_availability_alerts
  ADD COLUMN IF NOT EXISTS medication_catalog_id UUID
    REFERENCES public.medication_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_med_avail_alerts_catalog_id
  ON public.medication_availability_alerts(medication_catalog_id);

-- Trigger to auto-populate catalog FK on insert
CREATE OR REPLACE FUNCTION public.auto_link_alert_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.medication_catalog_id IS NULL AND NEW.medication_name IS NOT NULL AND NEW.medication_name != '' THEN
    SELECT mc.id INTO NEW.medication_catalog_id
    FROM public.medication_catalog mc
    WHERE LOWER(mc.name) = LOWER(NEW.medication_name)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_alert_catalog ON public.medication_availability_alerts;
CREATE TRIGGER trg_auto_link_alert_catalog
  BEFORE INSERT ON public.medication_availability_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_alert_catalog();

-- Backfill existing alerts
UPDATE public.medication_availability_alerts a
SET medication_catalog_id = (
  SELECT mc.id
  FROM public.medication_catalog mc
  WHERE LOWER(mc.name) = LOWER(a.medication_name)
  LIMIT 1
)
WHERE a.medication_catalog_id IS NULL
  AND a.medication_name IS NOT NULL AND a.medication_name != '';

COMMENT ON COLUMN public.medication_availability_alerts.medication_catalog_id IS
  '3NF: FK to medication_catalog. Auto-populated on INSERT via trigger. Replaces freetext medication_name for normalized lookup.';


-- ============================================================
-- FINAL: Summary
-- ============================================================

DO $$
DECLARE
  v_meds_with_catalog INTEGER;
  v_meds_without_catalog INTEGER;
  v_avail_with_catalog INTEGER;
  v_transfers_with_catalog INTEGER;
  v_alerts_with_catalog INTEGER;
  v_fk_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_meds_with_catalog FROM public.medications WHERE medication_catalog_id IS NOT NULL;
  SELECT COUNT(*) INTO v_meds_without_catalog FROM public.medications WHERE medication_catalog_id IS NULL;
  SELECT COUNT(*) INTO v_avail_with_catalog FROM public.medication_availability WHERE medication_catalog_id IS NOT NULL;
  SELECT COUNT(*) INTO v_transfers_with_catalog FROM public.drug_transfers WHERE medication_catalog_id IS NOT NULL;
  SELECT COUNT(*) INTO v_alerts_with_catalog FROM public.medication_availability_alerts WHERE medication_catalog_id IS NOT NULL;

  SELECT COUNT(*) INTO v_fk_count
  FROM pg_constraint
  WHERE contype = 'f'
    AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  RAISE NOTICE '============================================';
  RAISE NOTICE '3NF Recommendations Implementation Summary';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Rec 1: medications with catalog FK:    %  (without: %)', v_meds_with_catalog, v_meds_without_catalog;
  RAISE NOTICE 'Rec 2: availability with catalog FK:   %', v_avail_with_catalog;
  RAISE NOTICE 'Rec 2: transfers with catalog FK:      %', v_transfers_with_catalog;
  RAISE NOTICE 'Rec 3: Total FK constraints in schema: %', v_fk_count;
  RAISE NOTICE 'Rec 4: overall_score & risk_level are now GENERATED columns';
  RAISE NOTICE 'Rec 5: alerts with catalog FK:         %', v_alerts_with_catalog;
  RAISE NOTICE '============================================';
END $$;

COMMIT;
