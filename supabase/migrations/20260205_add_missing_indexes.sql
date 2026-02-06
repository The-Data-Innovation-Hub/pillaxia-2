-- ============================================================
-- Add missing indexes for frequently queried FK columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_by
  ON public.patient_vitals (recorded_by);

CREATE INDEX IF NOT EXISTS idx_lab_results_ordered_by
  ON public.lab_results (ordered_by);

CREATE INDEX IF NOT EXISTS idx_availability_notification_history_patient_user_id
  ON public.availability_notification_history (patient_user_id);
