-- Create controlled drug schedule enum
CREATE TYPE public.drug_schedule AS ENUM ('II', 'III', 'IV', 'V');

-- Create controlled drugs inventory table
CREATE TABLE public.controlled_drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  schedule drug_schedule NOT NULL,
  form TEXT NOT NULL DEFAULT 'tablet',
  strength TEXT NOT NULL,
  manufacturer TEXT,
  ndc_number TEXT,
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 10,
  unit_of_measure TEXT NOT NULL DEFAULT 'units',
  storage_location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT positive_stock CHECK (current_stock >= 0)
);

-- Create controlled drug dispensing records table
CREATE TABLE public.controlled_drug_dispensing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controlled_drug_id UUID NOT NULL REFERENCES public.controlled_drugs(id) ON DELETE RESTRICT,
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  prescriber_name TEXT NOT NULL,
  prescriber_dea TEXT,
  prescription_number TEXT NOT NULL,
  quantity_dispensed INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  dispensing_pharmacist_id UUID NOT NULL REFERENCES auth.users(id),
  witness_pharmacist_id UUID REFERENCES auth.users(id),
  dispensed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT positive_quantity CHECK (quantity_dispensed > 0)
);

-- Create stock adjustment log for receiving/adjusting inventory
CREATE TABLE public.controlled_drug_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controlled_drug_id UUID NOT NULL REFERENCES public.controlled_drugs(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('received', 'return', 'destroyed', 'loss', 'correction')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  invoice_number TEXT,
  supplier TEXT,
  reason TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  witness_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.controlled_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_drug_dispensing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_drug_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for controlled_drugs
CREATE POLICY "Pharmacists can view all controlled drugs"
  ON public.controlled_drugs FOR SELECT
  USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Pharmacists can create controlled drugs"
  ON public.controlled_drugs FOR INSERT
  WITH CHECK (is_pharmacist(auth.uid()));

CREATE POLICY "Pharmacists can update controlled drugs"
  ON public.controlled_drugs FOR UPDATE
  USING (is_pharmacist(auth.uid()));

-- RLS Policies for controlled_drug_dispensing
CREATE POLICY "Pharmacists can view all dispensing records"
  ON public.controlled_drug_dispensing FOR SELECT
  USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Pharmacists can create dispensing records"
  ON public.controlled_drug_dispensing FOR INSERT
  WITH CHECK (is_pharmacist(auth.uid()) AND auth.uid() = dispensing_pharmacist_id);

-- RLS Policies for controlled_drug_adjustments
CREATE POLICY "Pharmacists can view all adjustments"
  ON public.controlled_drug_adjustments FOR SELECT
  USING (is_pharmacist(auth.uid()) OR is_admin(auth.uid()));

CREATE POLICY "Pharmacists can create adjustments"
  ON public.controlled_drug_adjustments FOR INSERT
  WITH CHECK (is_pharmacist(auth.uid()) AND auth.uid() = performed_by);

-- Create trigger to update stock on dispensing
CREATE OR REPLACE FUNCTION public.update_controlled_drug_stock_on_dispense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.controlled_drugs
  SET current_stock = current_stock - NEW.quantity_dispensed,
      updated_at = now()
  WHERE id = NEW.controlled_drug_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_on_dispense
  AFTER INSERT ON public.controlled_drug_dispensing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_controlled_drug_stock_on_dispense();

-- Create trigger to update stock on adjustments
CREATE OR REPLACE FUNCTION public.update_controlled_drug_stock_on_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.controlled_drugs
  SET current_stock = NEW.new_stock,
      updated_at = now()
  WHERE id = NEW.controlled_drug_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_on_adjustment
  AFTER INSERT ON public.controlled_drug_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_controlled_drug_stock_on_adjustment();

-- Create trigger for updated_at on controlled_drugs
CREATE TRIGGER update_controlled_drugs_updated_at
  BEFORE UPDATE ON public.controlled_drugs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add audit logging triggers
CREATE TRIGGER audit_controlled_drugs
  AFTER INSERT OR UPDATE OR DELETE ON public.controlled_drugs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_controlled_drug_dispensing
  AFTER INSERT ON public.controlled_drug_dispensing
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

CREATE TRIGGER audit_controlled_drug_adjustments
  AFTER INSERT ON public.controlled_drug_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();