-- ============================================================
-- Phase 4: Performance Optimization
-- Date: 2026-02-05
-- Adds hot-path indexes, materialized view refresh, and query helpers
-- ============================================================

-- ============================================================
-- 1. Hot-path composite indexes
-- ============================================================

-- medication_logs: user + date range (schedule page, dashboard)
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_scheduled
  ON public.medication_logs(user_id, scheduled_time DESC);

-- symptom_entries: user + date range (symptom tracker)
CREATE INDEX IF NOT EXISTS idx_symptom_entries_user_recorded
  ON public.symptom_entries(user_id, recorded_at DESC);

-- notification_history: user + date (notification center)
CREATE INDEX IF NOT EXISTS idx_notification_history_user_created
  ON public.notification_history(user_id, created_at DESC);

-- medication_logs: status filtering (pending doses, missed doses)
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_status
  ON public.medication_logs(user_id, status)
  WHERE status IN ('pending', 'missed');

-- clinician_patient_assignments: clinician lookup
CREATE INDEX IF NOT EXISTS idx_cpa_clinician
  ON public.clinician_patient_assignments(clinician_user_id);

-- clinician_patient_assignments: patient lookup
CREATE INDEX IF NOT EXISTS idx_cpa_patient
  ON public.clinician_patient_assignments(patient_user_id);

-- security_events: user + date (security dashboard)
CREATE INDEX IF NOT EXISTS idx_security_events_user_created
  ON public.security_events(user_id, created_at DESC);

-- appointments: patient + date (calendar)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
  ON public.appointments(patient_user_id, appointment_date DESC);

-- appointments: clinician + date (clinician schedule)
CREATE INDEX IF NOT EXISTS idx_appointments_clinician_date
  ON public.appointments(clinician_user_id, appointment_date DESC);

-- ============================================================
-- 2. Partial indexes for active records
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_medications_user_active
  ON public.medications(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_controlled_drugs_active
  ON public.controlled_drugs(is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_active
  ON public.trusted_devices(user_id)
  WHERE is_active = true;

-- ============================================================
-- 3. GIN indexes for JSONB columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_security_events_metadata_gin
  ON public.security_events USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_user_sessions_device_info_gin
  ON public.user_sessions USING gin(device_info);

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_permissions_gin
  ON public.caregiver_invitations USING gin(permissions);

-- ============================================================
-- 4. Materialized view refresh function (called by pg_cron or scheduled job)
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh concurrently if index exists, otherwise normal refresh
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.medication_availability_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.medication_availability_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.patient_vitals_with_bmi_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.patient_vitals_with_bmi_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.medications_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.medications_full_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.controlled_drug_dispensing_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.controlled_drug_dispensing_full_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.drug_transfers_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.drug_transfers_full_view;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_invoices_full_view;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.organization_invoices_full_view;
  END;

  RAISE NOTICE 'All materialized views refreshed at %', now();
END;
$$;

-- ============================================================
-- 5. Enable pg_cron for scheduled refresh (requires server admin)
-- Run this manually on the Azure PostgreSQL server:
--   SELECT cron.schedule('refresh-mat-views', '*/15 * * * *', 'SELECT public.refresh_all_materialized_views()');
-- This refreshes all materialized views every 15 minutes.
-- ============================================================

-- ============================================================
-- 6. Analyze all tables for optimal query plans
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ANALYZE public.%I', tbl);
  END LOOP;
END $$;
