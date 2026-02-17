-- ============================================================
-- Phase 1: Schema Normalization Audit & Final Fixes
-- Date: 2026-02-05
-- Ensures all 3NF fixes are applied, adds FK to security_notification_preferences,
-- and verifies the schema state.
-- ============================================================

-- 1. Ensure security_notification_preferences.user_id has FK to public.users
-- (Original migration may not have FK constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND table_name = 'security_notification_preferences'
      AND constraint_name = 'fk_sec_notif_prefs_user_id'
  ) THEN
    ALTER TABLE public.security_notification_preferences
      ADD CONSTRAINT fk_sec_notif_prefs_user_id
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Add index on security_notification_preferences.user_id (if missing)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_sec_notif_prefs_user_id
  ON public.security_notification_preferences(user_id);

-- 3. Ensure medication_catalog exists and has data migration functions ready
-- (Already handled by 20260204152810 and 20260204152830 migrations)

-- 4. Add prescription_status enum constraint to medications if missing
-- (Already CHECK constraint in original schema)

-- 5. Verify all tables have updated_at triggers
-- (Comprehensive list — create only if trigger doesn't already exist)

DO $$
DECLARE
  tbl TEXT;
  trigger_name TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'security_notification_preferences',
      'patient_vitals',
      'lab_results',
      'patient_chronic_conditions',
      'patient_allergies',
      'patient_emergency_contacts'
    ])
  LOOP
    trigger_name := 'update_' || tbl || '_updated_at';
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = trigger_name
        AND event_object_table = tbl
        AND event_object_schema = 'public'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I;
CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        trigger_name, tbl
      );
    END IF;
  END LOOP;
END $$;

-- 6. Verify all audit-critical tables have audit triggers
-- (Already handled in original migrations for user_roles, profiles,
--  clinician_patient_assignments, controlled_drugs, controlled_drug_dispensing,
--  controlled_drug_adjustments)

-- 7. Add comments documenting intentional denormalizations
COMMENT ON COLUMN public.controlled_drug_dispensing.patient_name IS
  'Intentional denormalization: DEA compliance requires immutable point-in-time snapshot of patient name at dispensing time.';
COMMENT ON COLUMN public.controlled_drug_dispensing.prescriber_name IS
  'Intentional denormalization: DEA compliance requires immutable point-in-time snapshot of prescriber name at dispensing time.';
COMMENT ON COLUMN public.controlled_drug_dispensing.prescriber_dea IS
  'Intentional denormalization: DEA compliance requires immutable point-in-time snapshot of prescriber DEA number at dispensing time.';
COMMENT ON COLUMN public.prescriptions.medication_name IS
  'Intentional denormalization: Prescription is a legal document — preserves exact medication name at time of writing.';
COMMENT ON COLUMN public.prescriptions.generic_name IS
  'Intentional denormalization: Prescription is a legal document — preserves exact generic name at time of writing.';
COMMENT ON COLUMN public.medication_logs.medication_id IS
  'Intentional denormalization: Derivable from schedule_id but kept for direct lookup performance on the hottest query path.';
COMMENT ON COLUMN public.notification_history.title IS
  'Intentional denormalization: Audit trail requires immutable record of what was actually sent.';
COMMENT ON COLUMN public.notification_history.body IS
  'Intentional denormalization: Audit trail requires immutable record of what was actually sent.';
