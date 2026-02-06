-- Add expiry_date and lot_number to controlled_drugs.
-- These columns are required by the ExpiryTrackingCard component
-- to display and track expiry dates and lot numbers for controlled substances.
ALTER TABLE public.controlled_drugs
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS lot_number TEXT;
