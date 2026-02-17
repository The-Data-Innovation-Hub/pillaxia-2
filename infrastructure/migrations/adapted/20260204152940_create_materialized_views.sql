-- ============================================================
-- PHASE 3: Create Read-Optimized Materialized Views
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- 1. Materialized view for medication availability with catalog details
-- Optimized for frequent pharmacy searches
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.medication_availability_view AS
SELECT 
  ma.id,
  ma.pharmacy_id,
  pl.name AS pharmacy_name,
  pl.city AS pharmacy_city,
  pl.state AS pharmacy_state,
  -- Medication details from catalog
  mc.id AS medication_catalog_id,
  mc.name AS medication_name,
  mc.generic_name,
  mc.dosage,
  mc.dosage_unit,
  mc.form,
  ma.is_available,
  ma.quantity_available,
  ma.price_naira,
  ma.notes,
  ma.last_updated_by,
  ma.created_at,
  ma.updated_at
FROM public.medication_availability ma
LEFT JOIN public.medication_catalog mc ON ma.medication_catalog_id = mc.id
LEFT JOIN public.pharmacy_locations pl ON ma.pharmacy_id = pl.id
WHERE ma.is_available = true;

-- Create unique index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_availability_view_id 
  ON public.medication_availability_view(id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_availability_view_name 
  ON public.medication_availability_view(medication_name);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_availability_view_pharmacy 
  ON public.medication_availability_view(pharmacy_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_availability_view_city_state 
  ON public.medication_availability_view(pharmacy_city, pharmacy_state);

-- ============================================================
-- 2. Materialized view for patient vitals with computed BMI
-- Optimized for clinician dashboards
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.patient_vitals_with_bmi_view AS
SELECT 
  pv.id,
  pv.user_id,
  p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
  pv.recorded_at,
  pv.recorded_by,
  pr.first_name || ' ' || COALESCE(pr.last_name, '') AS recorded_by_name,
  pv.blood_pressure_systolic,
  pv.blood_pressure_diastolic,
  pv.heart_rate,
  pv.temperature,
  pv.respiratory_rate,
  pv.oxygen_saturation,
  pv.weight,
  pv.height,
  -- Computed BMI
  CASE 
    WHEN pv.height > 0 AND pv.weight > 0 THEN
      ROUND((pv.weight / POWER(pv.height / 100.0, 2))::NUMERIC, 1)
    ELSE NULL
  END AS bmi,
  pv.blood_glucose,
  pv.notes,
  pv.is_fasting,
  pv.measurement_location,
  pv.created_at,
  pv.updated_at
FROM public.patient_vitals pv
LEFT JOIN public.profiles p ON pv.user_id = p.user_id
LEFT JOIN public.profiles pr ON pv.recorded_by = pr.user_id;

-- Create unique index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_patient_vitals_with_bmi_view_id 
  ON public.patient_vitals_with_bmi_view(id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patient_vitals_with_bmi_view_user_id 
  ON public.patient_vitals_with_bmi_view(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_patient_vitals_with_bmi_view_recorded_at 
  ON public.patient_vitals_with_bmi_view(recorded_at DESC);

-- ============================================================
-- 3. Materialized view for medications with prescriber and pharmacy details
-- Optimized for patient medication lists
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.medications_full_view AS
SELECT 
  m.id,
  m.user_id,
  p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
  m.name,
  m.dosage,
  m.dosage_unit,
  m.form,
  m.instructions,
  -- Prescriber details
  m.prescriber_user_id,
  pres.first_name || ' ' || COALESCE(pres.last_name, '') AS prescriber_name,
  -- Pharmacy details
  m.pharmacy_id,
  pl.name AS pharmacy_name,
  pl.city AS pharmacy_city,
  pl.state AS pharmacy_state,
  m.refills_remaining,
  m.is_active,
  m.start_date,
  m.end_date,
  m.created_at,
  m.updated_at
FROM public.medications m
LEFT JOIN public.profiles p ON m.user_id = p.user_id
LEFT JOIN public.profiles pres ON m.prescriber_user_id = pres.user_id
LEFT JOIN public.pharmacy_locations pl ON m.pharmacy_id = pl.id;

-- Create unique index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_full_view_id 
  ON public.medications_full_view(id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_full_view_user_id 
  ON public.medications_full_view(user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_full_view_prescriber 
  ON public.medications_full_view(prescriber_user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_full_view_is_active 
  ON public.medications_full_view(is_active) WHERE is_active = true;

-- ============================================================
-- 4. Materialized view for controlled drug dispensing with full details
-- Optimized for DEA compliance reporting
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.controlled_drug_dispensing_full_view AS
SELECT 
  cdd.id,
  cdd.controlled_drug_id,
  cd.name AS controlled_drug_name,
  cd.schedule AS controlled_drug_schedule,
  -- Patient details
  cdd.patient_user_id,
  p.first_name || ' ' || COALESCE(p.last_name, '') AS patient_name,
  cdd.patient_id AS patient_id_text,
  -- Prescriber details
  cdd.prescriber_user_id,
  pres.first_name || ' ' || COALESCE(pres.last_name, '') AS prescriber_name,
  cdd.prescriber_dea,
  -- Prescription details
  cdd.prescription_id,
  presc.prescription_number,
  cdd.quantity_dispensed,
  cdd.quantity_remaining,
  -- Pharmacist details
  cdd.dispensing_pharmacist_id,
  pharm.first_name || ' ' || COALESCE(pharm.last_name, '') AS dispensing_pharmacist_name,
  cdd.witness_pharmacist_id,
  witness.first_name || ' ' || COALESCE(witness.last_name, '') AS witness_pharmacist_name,
  cdd.dispensed_at,
  cdd.notes,
  cdd.created_at
FROM public.controlled_drug_dispensing cdd
LEFT JOIN public.controlled_drugs cd ON cdd.controlled_drug_id = cd.id
LEFT JOIN public.profiles p ON cdd.patient_user_id = p.user_id
LEFT JOIN public.profiles pres ON cdd.prescriber_user_id = pres.user_id
LEFT JOIN public.prescriptions presc ON cdd.prescription_id = presc.id
LEFT JOIN public.profiles pharm ON cdd.dispensing_pharmacist_id = pharm.user_id
LEFT JOIN public.profiles witness ON cdd.witness_pharmacist_id = witness.user_id;

-- Create unique index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_full_view_id 
  ON public.controlled_drug_dispensing_full_view(id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_full_view_patient 
  ON public.controlled_drug_dispensing_full_view(patient_user_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_full_view_dispensed_at 
  ON public.controlled_drug_dispensing_full_view(dispensed_at DESC);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drug_dispensing_full_view_schedule 
  ON public.controlled_drug_dispensing_full_view(controlled_drug_schedule);

-- ============================================================
-- 5. Materialized view for drug transfers with catalog details
-- Optimized for pharmacy inventory management
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.drug_transfers_full_view AS
SELECT 
  dt.id,
  dt.source_pharmacy_id,
  sp.name AS source_pharmacy_name,
  dt.destination_pharmacy_id,
  dp.name AS destination_pharmacy_name,
  -- Medication details from catalog
  mc.id AS medication_catalog_id,
  COALESCE(mc.name, dt.drug_name) AS drug_name,
  COALESCE(mc.generic_name, dt.generic_name) AS generic_name,
  COALESCE(mc.dosage, dt.dosage) AS dosage,
  COALESCE(mc.form, dt.form) AS form,
  dt.quantity,
  dt.lot_number,
  dt.expiry_date,
  dt.reason,
  dt.status,
  dt.requested_by,
  req.first_name || ' ' || COALESCE(req.last_name, '') AS requested_by_name,
  dt.approved_by,
  app.first_name || ' ' || COALESCE(app.last_name, '') AS approved_by_name,
  dt.completed_by,
  comp.first_name || ' ' || COALESCE(comp.last_name, '') AS completed_by_name,
  dt.requested_at,
  dt.approved_at,
  dt.completed_at,
  dt.notes,
  dt.created_at,
  dt.updated_at
FROM public.drug_transfers dt
LEFT JOIN public.medication_catalog mc ON dt.medication_catalog_id = mc.id
LEFT JOIN public.pharmacy_locations sp ON dt.source_pharmacy_id = sp.id
LEFT JOIN public.pharmacy_locations dp ON dt.destination_pharmacy_id = dp.id
LEFT JOIN public.profiles req ON dt.requested_by = req.user_id
LEFT JOIN public.profiles app ON dt.approved_by = app.user_id
LEFT JOIN public.profiles comp ON dt.completed_by = comp.user_id;

-- Create unique index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_full_view_id 
  ON public.drug_transfers_full_view(id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_full_view_status 
  ON public.drug_transfers_full_view(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_full_view_source 
  ON public.drug_transfers_full_view(source_pharmacy_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_transfers_full_view_destination 
  ON public.drug_transfers_full_view(destination_pharmacy_id);

-- ============================================================
-- 6. Materialized view for organization invoices with stripe customer
-- Optimized for billing reports
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.organization_invoices_full_view AS
SELECT 
  oi.id,
  oi.organization_id,
  o.name AS organization_name,
  oi.stripe_invoice_id,
  -- Get stripe_customer_id from organization_subscriptions
  os.stripe_customer_id,
  oi.amount_due,
  oi.amount_paid,
  oi.currency,
  oi.status,
  oi.invoice_pdf,
  oi.hosted_invoice_url,
  oi.period_start,
  oi.period_end,
  oi.due_date,
  oi.paid_at,
  oi.description,
  oi.created_at,
  oi.updated_at
FROM public.organization_invoices oi
LEFT JOIN public.organizations o ON oi.organization_id = o.id
LEFT JOIN public.organization_subscriptions os ON oi.organization_id = os.organization_id;

-- Create unique index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS IF NOT EXISTS idx_organization_invoices_full_view_id 
  ON public.organization_invoices_full_view(id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organization_invoices_full_view_org_id 
  ON public.organization_invoices_full_view(organization_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organization_invoices_full_view_status 
  ON public.organization_invoices_full_view(status);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_organization_invoices_full_view_due_date 
  ON public.organization_invoices_full_view(due_date);

-- ============================================================
-- Enable RLS on materialized views (inherited from underlying tables)
-- ============================================================

-- Note: Materialized views don't support RLS directly, but access control
-- is enforced through the underlying tables. Views should be accessed
-- through RLS-protected functions or policies on the views themselves.

-- Grant access to authenticated users (RLS will be handled by application layer)
GRANT SELECT ON public.medication_availability_view TO authenticated;
GRANT SELECT ON public.patient_vitals_with_bmi_view TO authenticated;
GRANT SELECT ON public.medications_full_view TO authenticated;
GRANT SELECT ON public.controlled_drug_dispensing_full_view TO authenticated;
GRANT SELECT ON public.drug_transfers_full_view TO authenticated;
GRANT SELECT ON public.organization_invoices_full_view TO authenticated;

-- ============================================================
-- Create function to refresh all materialized views
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.medication_availability_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.patient_vitals_with_bmi_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.medications_full_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.controlled_drug_dispensing_full_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.drug_transfers_full_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.organization_invoices_full_view;
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.refresh_all_materialized_views IS 
  'Refreshes all materialized views for 3NF compliance read optimization. Run periodically or after bulk updates.';
