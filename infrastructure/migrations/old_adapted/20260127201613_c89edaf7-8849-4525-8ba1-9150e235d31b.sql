-- Drug recalls table
CREATE TABLE IF NOT EXISTS public.drug_recalls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  lot_numbers TEXT[] DEFAULT '{}',
  manufacturer TEXT,
  recall_reason TEXT NOT NULL,
  recall_class TEXT NOT NULL DEFAULT 'Class II', -- Class I (most serious), Class II, Class III
  affected_ndc_numbers TEXT[] DEFAULT '{}',
  recall_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date_range TEXT,
  instructions TEXT,
  fda_reference TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Drug recall notifications tracking
CREATE TABLE IF NOT EXISTS public.drug_recall_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recall_id UUID NOT NULL REFERENCES public.drug_recalls(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES public.pharmacy_locations(id),
  patient_user_id UUID,
  notification_type TEXT NOT NULL, -- 'pharmacy', 'patient'
  channels_used JSONB NOT NULL DEFAULT '[]',
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID
);

-- Drug transfers between pharmacy locations
CREATE TABLE IF NOT EXISTS public.drug_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_pharmacy_id UUID NOT NULL REFERENCES public.pharmacy_locations(id),
  destination_pharmacy_id UUID NOT NULL REFERENCES public.pharmacy_locations(id),
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT,
  form TEXT,
  quantity INTEGER NOT NULL,
  lot_number TEXT,
  expiry_date DATE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, in_transit, completed, rejected, cancelled
  requested_by UUID NOT NULL,
  approved_by UUID,
  completed_by UUID,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drug_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_recall_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_transfers ENABLE ROW LEVEL SECURITY;

-- Drug recalls policies
DROP POLICY IF EXISTS "Pharmacists and admins can view all recalls" ON public.drug_recalls;
CREATE POLICY "Pharmacists and admins can view all recalls"
ON public.drug_recalls FOR SELECT
USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pharmacists and admins can create recalls" ON public.drug_recalls;
CREATE POLICY "Pharmacists and admins can create recalls"
ON public.drug_recalls FOR INSERT
WITH CHECK (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pharmacists and admins can update recalls" ON public.drug_recalls;
CREATE POLICY "Pharmacists and admins can update recalls"
ON public.drug_recalls FOR UPDATE
USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

-- Drug recall notifications policies
DROP POLICY IF EXISTS "Pharmacists can view pharmacy notifications" ON public.drug_recall_notifications;
CREATE POLICY "Pharmacists can view pharmacy notifications"
ON public.drug_recall_notifications FOR SELECT
USING (
  is_pharmacist(auth.uid()) OR 
  is_admin(auth.uid()) OR 
  (auth.uid() = patient_user_id)
);

DROP POLICY IF EXISTS "Pharmacists can acknowledge notifications" ON public.drug_recall_notifications;
CREATE POLICY "Pharmacists can acknowledge notifications"
ON public.drug_recall_notifications FOR UPDATE
USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

-- Drug transfers policies
DROP POLICY IF EXISTS "Pharmacists can view transfers for their pharmacies" ON public.drug_transfers;
CREATE POLICY "Pharmacists can view transfers for their pharmacies"
ON public.drug_transfers FOR SELECT
USING (
  is_pharmacist(auth.uid()) AND (
    EXISTS (SELECT 1 FROM pharmacy_locations WHERE id = source_pharmacy_id AND pharmacist_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM pharmacy_locations WHERE id = destination_pharmacy_id AND pharmacist_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can view all transfers" ON public.drug_transfers;
CREATE POLICY "Admins can view all transfers"
ON public.drug_transfers FOR SELECT
USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Pharmacists can create transfer requests from their pharmacies" ON public.drug_transfers;
CREATE POLICY "Pharmacists can create transfer requests from their pharmacies"
ON public.drug_transfers FOR INSERT
WITH CHECK (
  is_pharmacist(auth.uid()) AND 
  auth.uid() = requested_by AND
  EXISTS (SELECT 1 FROM pharmacy_locations WHERE id = source_pharmacy_id AND pharmacist_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Pharmacists can update transfers for their pharmacies" ON public.drug_transfers;
CREATE POLICY "Pharmacists can update transfers for their pharmacies"
ON public.drug_transfers FOR UPDATE
USING (
  is_pharmacist(auth.uid()) AND (
    EXISTS (SELECT 1 FROM pharmacy_locations WHERE id = source_pharmacy_id AND pharmacist_user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM pharmacy_locations WHERE id = destination_pharmacy_id AND pharmacist_user_id = auth.uid())
  )
);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_drug_recalls_updated_at ON public.drug_recalls;
CREATE TRIGGER update_drug_recalls_updated_at
BEFORE UPDATE ON public.drug_recalls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_drug_transfers_updated_at ON public.drug_transfers;
CREATE TRIGGER update_drug_transfers_updated_at
BEFORE UPDATE ON public.drug_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();