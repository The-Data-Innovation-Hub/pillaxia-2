-- Phase 5: Replace Materialized Views with Regular Views
-- This migration replaces materialized views with regular views to eliminate
-- denormalized data copies and improve data consistency.

-- ============================================================
-- PART 1: Replace medications_full_view
-- ============================================================

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.medications_full_view CASCADE;

-- Create regular view (already created in Phase 3 as medications_full)
-- This view provides JOINed data from medications and medication_catalog

-- ============================================================
-- PART 2: Replace controlled_drug_dispensing_full_view
-- ============================================================

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.controlled_drug_dispensing_full_view CASCADE;

-- Create optimized regular view (already created in Phase 3 as controlled_drug_dispensing_full)

-- ============================================================
-- PART 3: Replace drug_transfers_full_view
-- ============================================================

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.drug_transfers_full_view CASCADE;

-- Create regular view (already created in Phase 3 as drug_transfers_full)

-- ============================================================
-- PART 4: Replace organization_invoices_full_view
-- ============================================================

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.organization_invoices_full_view CASCADE;

-- Create regular view with organization details
CREATE OR REPLACE VIEW public.organization_invoices_full AS
SELECT
  oi.id,
  oi.organization_id,
  o.name AS organization_name,
  o.contact_email AS organization_email,
  oi.subscription_id,
  os.stripe_subscription_id,
  os.plan_name,
  os.billing_interval,
  oi.invoice_number,
  oi.amount_due,
  oi.amount_paid,
  oi.currency,
  oi.status,
  oi.due_date,
  oi.paid_at,
  oi.stripe_invoice_id,
  oi.stripe_invoice_url,
  oi.stripe_hosted_invoice_url,
  oi.invoice_pdf_url,
  oi.metadata,
  oi.created_at,
  oi.updated_at
FROM public.organization_invoices oi
LEFT JOIN public.organizations o ON oi.organization_id = o.id
LEFT JOIN public.organization_subscriptions os ON oi.subscription_id = os.id;

-- ============================================================
-- PART 5: Replace patient_vitals_with_bmi_view
-- ============================================================

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.patient_vitals_with_bmi_view CASCADE;

-- Create regular view with BMI calculation
CREATE OR REPLACE VIEW public.patient_vitals_with_bmi AS
SELECT
  pv.id,
  pv.patient_user_id,
  p.first_name || ' ' || p.last_name AS patient_name,
  pv.weight_kg,
  pv.height_cm,
  pv.systolic_bp,
  pv.diastolic_bp,
  pv.heart_rate,
  pv.temperature_celsius,
  pv.oxygen_saturation,
  pv.respiratory_rate,
  pv.blood_glucose,
  -- Calculate BMI: weight(kg) / (height(m) ^ 2)
  CASE
    WHEN pv.height_cm > 0 AND pv.weight_kg > 0 THEN
      ROUND((pv.weight_kg / POWER(pv.height_cm / 100.0, 2))::numeric, 2)
    ELSE NULL
  END AS bmi,
  -- BMI category
  CASE
    WHEN pv.height_cm > 0 AND pv.weight_kg > 0 THEN
      CASE
        WHEN (pv.weight_kg / POWER(pv.height_cm / 100.0, 2)) < 18.5 THEN 'Underweight'
        WHEN (pv.weight_kg / POWER(pv.height_cm / 100.0, 2)) BETWEEN 18.5 AND 24.9 THEN 'Normal'
        WHEN (pv.weight_kg / POWER(pv.height_cm / 100.0, 2)) BETWEEN 25.0 AND 29.9 THEN 'Overweight'
        ELSE 'Obese'
      END
    ELSE NULL
  END AS bmi_category,
  pv.recorded_at,
  pv.recorded_by,
  pv.notes,
  pv.created_at,
  pv.updated_at
FROM public.patient_vitals pv
LEFT JOIN public.profiles p ON pv.patient_user_id = p.user_id;

-- ============================================================
-- PART 6: Replace medication_availability_view
-- ============================================================

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.medication_availability_view CASCADE;

-- Create regular view (already created in Phase 3 as medication_availability_full)
-- Ensure it's optimized
CREATE OR REPLACE VIEW public.medication_availability_view AS
SELECT
  ma.id,
  ma.pharmacy_id,
  pl.name AS pharmacy_name,
  pl.city AS pharmacy_city,
  pl.state AS pharmacy_state,
  ma.medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.dosage_unit,
  mc.form,
  ma.quantity_in_stock,
  ma.low_stock_threshold,
  ma.is_available,
  CASE
    WHEN ma.quantity_in_stock <= ma.low_stock_threshold THEN 'low'
    WHEN ma.quantity_in_stock = 0 OR NOT ma.is_available THEN 'out'
    ELSE 'in_stock'
  END AS stock_status,
  ma.last_restocked_at,
  ma.created_at,
  ma.updated_at
FROM public.medication_availability ma
LEFT JOIN public.pharmacy_locations pl ON ma.pharmacy_id = pl.id
LEFT JOIN public.medication_catalog mc ON ma.medication_catalog_id = mc.id;

-- ============================================================
-- PART 7: Create Additional Optimized Views
-- ============================================================

-- View for active medications with user details
CREATE OR REPLACE VIEW public.active_medications_detail AS
SELECT
  m.id,
  m.user_id,
  p.first_name || ' ' || p.last_name AS patient_name,
  p.email AS patient_email,
  m.medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.dosage_unit,
  mc.form,
  m.instructions,
  m.prescriber,
  m.prescriber_user_id,
  pp.first_name || ' ' || pp.last_name AS prescriber_name,
  m.pharmacy_id,
  pl.name AS pharmacy_name,
  m.refills_remaining,
  m.refills_authorized,
  m.prescription_status,
  m.start_date,
  m.end_date,
  m.created_at,
  m.updated_at
FROM public.medications m
LEFT JOIN public.profiles p ON m.user_id = p.user_id
LEFT JOIN public.medication_catalog mc ON m.medication_catalog_id = mc.id
LEFT JOIN public.profiles pp ON m.prescriber_user_id = pp.user_id
LEFT JOIN public.pharmacy_locations pl ON m.pharmacy_id = pl.id
WHERE m.is_active = true;

-- View for pending prescriptions with full details
CREATE OR REPLACE VIEW public.pending_prescriptions_detail AS
SELECT
  pr.id,
  pr.patient_user_id,
  pp.first_name || ' ' || pp.last_name AS patient_name,
  pp.email AS patient_email,
  pr.clinician_user_id,
  cp.first_name || ' ' || cp.last_name AS clinician_name,
  pr.prescription_number,
  pr.medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.dosage_unit,
  mc.form,
  pr.quantity,
  pr.refills,
  pr.instructions,
  pr.status,
  pr.date_written,
  pr.pharmacy_id,
  pl.name AS pharmacy_name,
  pl.phone AS pharmacy_phone,
  pr.pharmacy_notes,
  pr.clinician_notes,
  pr.created_at,
  pr.updated_at
FROM public.prescriptions pr
LEFT JOIN public.profiles pp ON pr.patient_user_id = pp.user_id
LEFT JOIN public.profiles cp ON pr.clinician_user_id = cp.user_id
LEFT JOIN public.medication_catalog mc ON pr.medication_catalog_id = mc.id
LEFT JOIN public.pharmacy_locations pl ON pr.pharmacy_id = pl.id
WHERE pr.status IN ('pending', 'sent_to_pharmacy', 'processing');

-- ============================================================
-- PART 8: Add Indexes to Support View Performance
-- ============================================================

-- Index for active medications view
CREATE INDEX IF NOT EXISTS idx_medications_active_user
  ON public.medications(user_id, is_active)
  WHERE is_active = true;

-- Index for pending prescriptions view
CREATE INDEX IF NOT EXISTS idx_prescriptions_status
  ON public.prescriptions(status)
  WHERE status IN ('pending', 'sent_to_pharmacy', 'processing');

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_status
  ON public.prescriptions(patient_user_id, status);

-- Index for medication availability lookups
CREATE INDEX IF NOT EXISTS idx_medication_availability_pharmacy_catalog
  ON public.medication_availability(pharmacy_id, medication_catalog_id);

CREATE INDEX IF NOT EXISTS idx_medication_availability_low_stock
  ON public.medication_availability(pharmacy_id, is_available)
  WHERE quantity_in_stock <= low_stock_threshold OR NOT is_available;

-- Index for vitals queries
CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_recorded
  ON public.patient_vitals(patient_user_id, recorded_at DESC);

-- ============================================================
-- PART 9: Drop Old Materialized View Refresh Functions (if any)
-- ============================================================

-- Drop any scheduled refresh functions for materialized views
DROP FUNCTION IF EXISTS public.refresh_medications_full_view() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_controlled_drug_dispensing_full_view() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_drug_transfers_full_view() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_organization_invoices_full_view() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_patient_vitals_with_bmi_view() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_medication_availability_view() CASCADE;

-- ============================================================
-- PART 10: Create View Performance Monitoring
-- ============================================================

-- Function to analyze view performance
CREATE OR REPLACE FUNCTION public.analyze_view_performance(
  p_view_name text
) RETURNS TABLE (
  view_name text,
  estimated_rows bigint,
  total_size_bytes bigint,
  table_dependencies text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_view_name::text,
    c.reltuples::bigint AS estimated_rows,
    pg_total_relation_size(c.oid) AS total_size_bytes,
    ARRAY_AGG(DISTINCT referenced_table::text) AS table_dependencies
  FROM pg_class c
  LEFT JOIN pg_depend d ON d.refobjid = c.oid
  LEFT JOIN pg_class referenced_table ON d.objid = referenced_table.oid
  WHERE c.relname = p_view_name
    AND c.relkind = 'v'
  GROUP BY c.oid, c.reltuples;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Success Message
-- ============================================================

SELECT 'Phase 5 migration completed: Replaced materialized views with regular views' AS status;

-- ============================================================
-- IMPORTANT NOTES FOR APPLICATION DEVELOPERS
-- ============================================================

/*
After this migration:

1. Materialized views have been replaced with regular views
   - Views now show real-time data (no refresh needed)
   - No more stale data issues
   - Slightly more query overhead (acceptable for most use cases)

2. Array columns have been normalized
   - drug_recalls.lot_numbers → drug_recall_lot_numbers table
   - drug_recalls.affected_ndc_numbers → drug_recall_ndc_numbers table
   - medication_schedules.days_of_week → medication_schedule_days table
   - Use helper functions: add_drug_recall_lot_number(), set_medication_schedule_days()

3. Redundant text fields removed from:
   - medications table (use medications_full view)
   - prescriptions table (use prescriptions_full view)
   - drug_transfers table (use drug_transfers_full view)
   - medication_availability table (use medication_availability_full view)
   - controlled_drug_dispensing table (use controlled_drug_dispensing_full view)

4. Notification preferences consolidated
   - security_notification_preferences → user_notification_preferences
   - patient_notification_preferences → user_notification_preferences
   - Use helper functions: is_notification_enabled(), set_notification_preference()
   - Views available for backward compatibility

5. New views available:
   - active_medications_detail
   - pending_prescriptions_detail
   - patient_vitals_with_bmi

6. All foreign keys, indexes, and constraints have been added

TESTING CHECKLIST:
□ Verify medication lookups still work
□ Verify prescription creation still works
□ Verify notification preferences can be read/updated
□ Verify drug recall queries work with new junction tables
□ Verify medication schedules work with new junction table
□ Check query performance on high-traffic views
□ Verify backward compatibility views match expected structure

PERFORMANCE NOTES:
- Views should perform well with proper indexes (added in migrations)
- If a specific view is slow, consider:
  a) Adding more specific indexes
  b) Using a materialized view for that specific use case
  c) Caching at application level
*/
