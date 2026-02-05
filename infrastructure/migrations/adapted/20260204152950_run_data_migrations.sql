-- ============================================================
-- PHASE 4: Run Data Migration Scripts
-- Part of 3NF Compliance Fix Plan
-- ============================================================
-- This script populates new FK columns from existing TEXT data
-- Run this after all table structure changes are in place
-- ============================================================

-- ============================================================
-- Step 1: Migrate medications table
-- ============================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.migrate_medications_text_to_fks();
  
  RAISE NOTICE 'Medications Migration Results:';
  RAISE NOTICE '  Total medications: %', v_result.migrated_count;
  RAISE NOTICE '  Prescribers matched: %', v_result.prescriber_matched;
  RAISE NOTICE '  Pharmacies matched: %', v_result.pharmacy_matched;
  RAISE NOTICE '  Prescribers unmatched: %', v_result.prescriber_unmatched;
  RAISE NOTICE '  Pharmacies unmatched: %', v_result.pharmacy_unmatched;
END $$;

-- ============================================================
-- Step 2: Migrate medication_availability table
-- ============================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.migrate_medication_availability_to_catalog();
  
  RAISE NOTICE 'Medication Availability Migration Results:';
  RAISE NOTICE '  Catalog entries created: %', v_result.catalog_entries_created;
  RAISE NOTICE '  Availability records migrated: %', v_result.availability_records_migrated;
  RAISE NOTICE '  Unmatched records: %', v_result.unmatched_records;
END $$;

-- ============================================================
-- Step 3: Migrate controlled_drug_dispensing table
-- ============================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.migrate_controlled_drug_dispensing_to_fks();
  
  RAISE NOTICE 'Controlled Drug Dispensing Migration Results:';
  RAISE NOTICE '  Patients matched: %', v_result.patient_matched;
  RAISE NOTICE '  Prescribers matched: %', v_result.prescriber_matched;
  RAISE NOTICE '  Prescriptions matched: %', v_result.prescription_matched;
  RAISE NOTICE '  Patients unmatched: %', v_result.patient_unmatched;
  RAISE NOTICE '  Prescribers unmatched: %', v_result.prescriber_unmatched;
  RAISE NOTICE '  Prescriptions unmatched: %', v_result.prescription_unmatched;
END $$;

-- ============================================================
-- Step 4: Migrate drug_transfers table
-- ============================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.migrate_drug_transfers_to_catalog();
  
  RAISE NOTICE 'Drug Transfers Migration Results:';
  RAISE NOTICE '  Catalog entries created: %', v_result.catalog_entries_created;
  RAISE NOTICE '  Transfer records migrated: %', v_result.transfers_migrated;
  RAISE NOTICE '  Unmatched records: %', v_result.unmatched_records;
END $$;

-- ============================================================
-- Step 5: Verify medication_schedules integrity
-- ============================================================

DO $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.check_medication_schedules_integrity();
  
  RAISE NOTICE 'Medication Schedules Integrity Check:';
  RAISE NOTICE '  Orphaned schedules: %', v_result.orphaned_schedules;
  RAISE NOTICE '  Schedules with mismatched user_id: %', v_result.schedules_with_mismatched_user_id;
  
  IF v_result.orphaned_schedules > 0 OR v_result.schedules_with_mismatched_user_id > 0 THEN
    RAISE WARNING 'Data integrity issues found. Review before removing user_id column.';
  END IF;
END $$;

-- ============================================================
-- Step 6: Initial refresh of materialized views
-- ============================================================

SELECT public.refresh_all_materialized_views();

RAISE NOTICE 'All materialized views refreshed successfully.';

-- ============================================================
-- Summary Report
-- ============================================================

DO $$
DECLARE
  v_medications_with_prescriber INTEGER;
  v_medications_with_pharmacy INTEGER;
  v_availability_with_catalog INTEGER;
  v_dispensing_with_patient INTEGER;
  v_dispensing_with_prescriber INTEGER;
  v_dispensing_with_prescription INTEGER;
  v_transfers_with_catalog INTEGER;
BEGIN
  -- Count migrated records
  SELECT COUNT(*) INTO v_medications_with_prescriber
  FROM public.medications WHERE prescriber_user_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_medications_with_pharmacy
  FROM public.medications WHERE pharmacy_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_availability_with_catalog
  FROM public.medication_availability WHERE medication_catalog_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_dispensing_with_patient
  FROM public.controlled_drug_dispensing WHERE patient_user_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_dispensing_with_prescriber
  FROM public.controlled_drug_dispensing WHERE prescriber_user_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_dispensing_with_prescription
  FROM public.controlled_drug_dispensing WHERE prescription_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_transfers_with_catalog
  FROM public.drug_transfers WHERE medication_catalog_id IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '3NF Migration Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Medications with prescriber FK: %', v_medications_with_prescriber;
  RAISE NOTICE 'Medications with pharmacy FK: %', v_medications_with_pharmacy;
  RAISE NOTICE 'Medication availability with catalog FK: %', v_availability_with_catalog;
  RAISE NOTICE 'Dispensing records with patient FK: %', v_dispensing_with_patient;
  RAISE NOTICE 'Dispensing records with prescriber FK: %', v_dispensing_with_prescriber;
  RAISE NOTICE 'Dispensing records with prescription FK: %', v_dispensing_with_prescription;
  RAISE NOTICE 'Drug transfers with catalog FK: %', v_transfers_with_catalog;
  RAISE NOTICE '========================================';
END $$;
