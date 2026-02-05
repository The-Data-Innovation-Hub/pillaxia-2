-- ============================================================
-- PHASE 1: Create Supporting Tables and Add Missing FKs
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- 1. Create medication_catalog table
-- Normalizes medication information for reference by other tables
-- ============================================================

CREATE TABLE public.medication_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT NOT NULL,
  dosage_unit TEXT NOT NULL DEFAULT 'mg',
  form TEXT NOT NULL DEFAULT 'tablet', -- tablet, capsule, liquid, injection, etc.
  ndc_number TEXT,
  manufacturer TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure unique combination of medication details
  UNIQUE(name, dosage, dosage_unit, form)
);

-- Enable RLS
ALTER TABLE public.medication_catalog ENABLE ROW LEVEL SECURITY;

-- RLS Policies for medication_catalog
-- All authenticated users can view active medications
CREATE POLICY "Authenticated users can view active medications"
  ON public.medication_catalog FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Pharmacists and admins can manage catalog
CREATE POLICY "Pharmacists and admins can manage medication catalog"
  ON public.medication_catalog FOR ALL
  USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_medication_catalog_name ON public.medication_catalog(name);
CREATE INDEX idx_medication_catalog_generic_name ON public.medication_catalog(generic_name);
CREATE INDEX idx_medication_catalog_is_active ON public.medication_catalog(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_medication_catalog_updated_at
  BEFORE UPDATE ON public.medication_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Add missing FOREIGN KEY constraint for pharmacy_locations
-- ============================================================

-- Add FK constraint for pharmacist_user_id
ALTER TABLE public.pharmacy_locations
  ADD CONSTRAINT fk_pharmacy_locations_pharmacist_user_id
  FOREIGN KEY (pharmacist_user_id)
  REFERENCES public.users(id)
  ON DELETE RESTRICT;

-- Add comment documenting the constraint
COMMENT ON CONSTRAINT fk_pharmacy_locations_pharmacist_user_id ON public.pharmacy_locations 
  IS 'Ensures pharmacist_user_id references a valid user. Part of 3NF compliance.';
