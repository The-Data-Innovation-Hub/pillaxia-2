-- Add expiry tracking to controlled_drugs table
ALTER TABLE public.controlled_drugs
ADD COLUMN expiry_date date,
ADD COLUMN lot_number text,
ADD COLUMN expiry_alert_sent boolean NOT NULL DEFAULT false;

-- Create index for expiry date queries
CREATE INDEX IF NOT EXISTS idx_controlled_drugs_expiry ON public.controlled_drugs(expiry_date) WHERE expiry_date IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.controlled_drugs.expiry_date IS 'Medication expiry date for inventory tracking';
COMMENT ON COLUMN public.controlled_drugs.lot_number IS 'Lot/batch number for traceability';
COMMENT ON COLUMN public.controlled_drugs.expiry_alert_sent IS 'Whether expiry alert has been sent for this batch';