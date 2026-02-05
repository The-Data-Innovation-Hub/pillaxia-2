-- ============================================================
-- PHASE 2: Fix organization_invoices table - Remove duplicate stripe_customer_id
-- Part of 3NF Compliance Fix Plan
-- ============================================================

-- ============================================================
-- Step 1: Create view with stripe_customer_id from join before removing column
-- ============================================================

CREATE OR REPLACE VIEW public.organization_invoices_full AS
SELECT 
  oi.id,
  oi.organization_id,
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
LEFT JOIN public.organization_subscriptions os ON oi.organization_id = os.organization_id;

-- Grant access (RLS enforced through underlying table)

-- ============================================================
-- Step 2: Remove duplicate stripe_customer_id column
-- ============================================================

ALTER TABLE public.organization_invoices DROP COLUMN IF EXISTS stripe_customer_id;

-- Add comment
COMMENT ON VIEW public.organization_invoices_full IS 
  'Organization invoices with stripe_customer_id from organization_subscriptions join. Part of 3NF compliance.';

COMMENT ON TABLE public.organization_invoices IS 
  'Organization invoices. stripe_customer_id available via organization_invoices_full view joining with organization_subscriptions. Part of 3NF compliance.';
