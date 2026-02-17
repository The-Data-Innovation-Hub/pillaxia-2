-- ============================================================
-- PHASE 5: Add Missing Indexes for Performance
-- Part of 3NF Compliance Fix Plan
-- ============================================================
-- This ensures all FK columns and materialized view keys are indexed
-- ============================================================

-- ============================================================
-- Indexes for medication_catalog table
-- ============================================================

-- Already created in initial migration, but ensure they exist
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_catalog_name ON public.medication_catalog(name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_catalog_generic_name ON public.medication_catalog(generic_name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_catalog_is_active ON public.medication_catalog(is_active) WHERE is_active = true;

-- ============================================================
-- Indexes for medications table (new FK columns)
-- ============================================================

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_prescriber_user_id ON public.medications(prescriber_user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_pharmacy_id ON public.medications(pharmacy_id);

-- Composite index for common query pattern: user + prescriber
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_user_prescriber 
  ON public.medications(user_id, prescriber_user_id) 
  WHERE prescriber_user_id IS NOT NULL;

-- ============================================================
-- Indexes for medication_availability table
-- ============================================================

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_availability_catalog_id ON public.medication_availability(medication_catalog_id);

-- Composite index for pharmacy + catalog lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_availability_pharmacy_catalog 
  ON public.medication_availability(pharmacy_id, medication_catalog_id) 
  WHERE is_available = true;

-- ============================================================
-- Indexes for controlled_drug_dispensing table
-- ============================================================

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_patient_user_id 
  ON public.controlled_drug_dispensing(patient_user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_prescriber_user_id 
  ON public.controlled_drug_dispensing(prescriber_user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_prescription_id 
  ON public.controlled_drug_dispensing(prescription_id);

-- Composite index for patient + prescriber queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_patient_prescriber 
  ON public.controlled_drug_dispensing(patient_user_id, prescriber_user_id);

-- Index for date-based queries (common for compliance reports)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_dispensed_at 
  ON public.controlled_drug_dispensing(dispensed_at DESC);

-- ============================================================
-- Indexes for drug_transfers table
-- ============================================================

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_catalog_id ON public.drug_transfers(medication_catalog_id);

-- Composite indexes for transfer queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_source_status 
  ON public.drug_transfers(source_pharmacy_id, status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_destination_status 
  ON public.drug_transfers(destination_pharmacy_id, status);

-- ============================================================
-- Indexes for organization_invoices (no new FKs, but optimize joins)
-- ============================================================

-- Index for joining with organization_subscriptions
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organization_invoices_org_id 
  ON public.organization_invoices(organization_id);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organization_invoices_due_date 
  ON public.organization_invoices(due_date) 
  WHERE status != 'paid';

-- ============================================================
-- Indexes for medication_schedules (after user_id removal)
-- ============================================================

-- Index on medication_id for joining with medications
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_schedules_medication_id 
  ON public.medication_schedules(medication_id);

-- Composite index for active schedules by medication
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_schedules_medication_active 
  ON public.medication_schedules(medication_id, is_active) 
  WHERE is_active = true;

-- ============================================================
-- Indexes for profiles table (after email/organization removal)
-- ============================================================

-- Ensure organization_id is indexed (may already exist)
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- Composite index for organization + user queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_profiles_org_user 
  ON public.profiles(organization_id, user_id) 
  WHERE organization_id IS NOT NULL;

-- ============================================================
-- Additional indexes for common query patterns
-- ============================================================

-- Index for patient_vitals user + date queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patient_vitals_user_recorded 
  ON public.patient_vitals(user_id, recorded_at DESC);

-- Index for prescriptions by patient and status
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_patient_status 
  ON public.prescriptions(patient_user_id, status);

-- Index for prescriptions by clinician and date
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_clinician_date 
  ON public.prescriptions(clinician_user_id, date_written DESC);

-- ============================================================
-- Analyze tables after index creation for query planner
-- ============================================================

ANALYZE public.medication_catalog;
ANALYZE public.medications;
ANALYZE public.medication_availability;
ANALYZE public.controlled_drug_dispensing;
ANALYZE public.drug_transfers;
ANALYZE public.organization_invoices;
ANALYZE public.medication_schedules;
ANALYZE public.profiles;

-- Add comment
COMMENT ON INDEX idx_medications_prescriber_user_id IS 
  'Index for 3NF compliance - FK to prescriber user. Part of normalization.';
COMMENT ON INDEX idx_medication_availability_catalog_id IS 
  'Index for 3NF compliance - FK to medication catalog. Part of normalization.';
