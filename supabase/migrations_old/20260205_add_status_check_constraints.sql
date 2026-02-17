-- ============================================================
-- Add CHECK constraints for unconstrained status TEXT fields
-- ============================================================

-- drug_transfers.status
DO $$ BEGIN
  ALTER TABLE public.drug_transfers
    ADD CONSTRAINT chk_drug_transfers_status
    CHECK (status IN ('pending','approved','in_transit','completed','rejected','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- organization_invoices.status
DO $$ BEGIN
  ALTER TABLE public.organization_invoices
    ADD CONSTRAINT chk_organization_invoices_status
    CHECK (status IN ('draft','pending','paid','overdue','cancelled','void'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lab_results.status
DO $$ BEGIN
  ALTER TABLE public.lab_results
    ADD CONSTRAINT chk_lab_results_status
    CHECK (status IN ('pending','completed','reviewed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lab_results.abnormal_flag
DO $$ BEGIN
  ALTER TABLE public.lab_results
    ADD CONSTRAINT chk_lab_results_abnormal_flag
    CHECK (abnormal_flag IN ('normal','low','high','critical'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
