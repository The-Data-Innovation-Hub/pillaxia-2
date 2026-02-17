-- Create pharmacy locations table for Nigerian pharmacies
CREATE TABLE IF NOT EXISTS public.pharmacy_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacist_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medication availability table
CREATE TABLE IF NOT EXISTS public.medication_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacy_locations(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT,
  form TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  quantity_available INTEGER,
  price_naira NUMERIC(10, 2),
  notes TEXT,
  last_updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient preferred pharmacies table
CREATE TABLE IF NOT EXISTS public.patient_preferred_pharmacies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacy_locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_user_id, pharmacy_id)
);

-- Create medication availability alerts subscription table
CREATE TABLE IF NOT EXISTS public.medication_availability_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  medication_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_sms BOOLEAN NOT NULL DEFAULT true,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_push BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create availability notification history table
CREATE TABLE IF NOT EXISTS public.availability_notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.medication_availability_alerts(id) ON DELETE CASCADE,
  availability_id UUID NOT NULL REFERENCES public.medication_availability(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  channels_used JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Enable RLS on all tables
ALTER TABLE public.pharmacy_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_preferred_pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_availability_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_notification_history ENABLE ROW LEVEL SECURITY;

-- Pharmacy locations policies
DROP POLICY IF EXISTS "Pharmacists can manage their pharmacies" ON public.pharmacy_locations;
CREATE POLICY "Pharmacists can manage their pharmacies"
ON public.pharmacy_locations FOR ALL
USING (is_pharmacist(auth.uid()) AND auth.uid() = pharmacist_user_id);

DROP POLICY IF EXISTS "Everyone can view active pharmacies" ON public.pharmacy_locations;
CREATE POLICY "Everyone can view active pharmacies"
ON public.pharmacy_locations FOR SELECT
USING (is_active = true);

-- Medication availability policies
DROP POLICY IF EXISTS "Pharmacists can manage availability at their pharmacies" ON public.medication_availability;
CREATE POLICY "Pharmacists can manage availability at their pharmacies"
ON public.medication_availability FOR ALL
USING (
  is_pharmacist(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.pharmacy_locations 
    WHERE id = pharmacy_id AND pharmacist_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Everyone can view available medications" ON public.medication_availability;
CREATE POLICY "Everyone can view available medications"
ON public.medication_availability FOR SELECT
USING (is_available = true);

-- Patient preferred pharmacies policies
DROP POLICY IF EXISTS "Patients can manage their preferred pharmacies" ON public.patient_preferred_pharmacies;
CREATE POLICY "Patients can manage their preferred pharmacies"
ON public.patient_preferred_pharmacies FOR ALL
USING (is_patient(auth.uid()) AND auth.uid() = patient_user_id);

-- Medication availability alerts policies
DROP POLICY IF EXISTS "Patients can manage their availability alerts" ON public.medication_availability_alerts;
CREATE POLICY "Patients can manage their availability alerts"
ON public.medication_availability_alerts FOR ALL
USING (is_patient(auth.uid()) AND auth.uid() = patient_user_id);

-- Availability notification history policies
DROP POLICY IF EXISTS "Patients can view their notification history" ON public.availability_notification_history;
CREATE POLICY "Patients can view their notification history"
ON public.availability_notification_history FOR SELECT
USING (auth.uid() = patient_user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_state ON public.pharmacy_locations(state);
CREATE INDEX IF NOT EXISTS idx_pharmacy_locations_city ON public.pharmacy_locations(city);
CREATE INDEX IF NOT EXISTS idx_medication_availability_name ON public.medication_availability(medication_name);
CREATE INDEX IF NOT EXISTS idx_medication_availability_pharmacy ON public.medication_availability(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_patient_preferred_pharmacies_patient ON public.patient_preferred_pharmacies(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_medication_alerts_patient ON public.medication_availability_alerts(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_medication_alerts_name ON public.medication_availability_alerts(medication_name);

-- Create trigger for updated_at on pharmacy_locations
DROP TRIGGER IF EXISTS update_pharmacy_locations_updated_at ON public.pharmacy_locations;
CREATE TRIGGER update_pharmacy_locations_updated_at
BEFORE UPDATE ON public.pharmacy_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on medication_availability
DROP TRIGGER IF EXISTS update_medication_availability_updated_at ON public.medication_availability;
CREATE TRIGGER update_medication_availability_updated_at
BEFORE UPDATE ON public.medication_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on medication_availability_alerts
DROP TRIGGER IF EXISTS update_medication_availability_alerts_updated_at ON public.medication_availability_alerts;
CREATE TRIGGER update_medication_availability_alerts_updated_at
BEFORE UPDATE ON public.medication_availability_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();