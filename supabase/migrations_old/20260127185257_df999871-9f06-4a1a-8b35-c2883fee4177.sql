-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinician_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  location TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'))
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Clinicians can create appointments for their assigned patients
CREATE POLICY "Clinicians can create appointments for assigned patients"
ON public.appointments
FOR INSERT
WITH CHECK (
  auth.uid() = clinician_user_id 
  AND is_clinician_assigned(patient_user_id, auth.uid())
);

-- Clinicians can view their own appointments
CREATE POLICY "Clinicians can view their appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = clinician_user_id);

-- Clinicians can update their own appointments
CREATE POLICY "Clinicians can update their appointments"
ON public.appointments
FOR UPDATE
USING (auth.uid() = clinician_user_id)
WITH CHECK (auth.uid() = clinician_user_id);

-- Clinicians can delete their own appointments
CREATE POLICY "Clinicians can delete their appointments"
ON public.appointments
FOR DELETE
USING (auth.uid() = clinician_user_id);

-- Patients can view their own appointments
CREATE POLICY "Patients can view their appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = patient_user_id);

-- Patients can update status (confirm/cancel)
CREATE POLICY "Patients can confirm or cancel their appointments"
ON public.appointments
FOR UPDATE
USING (auth.uid() = patient_user_id)
WITH CHECK (auth.uid() = patient_user_id AND status IN ('confirmed', 'cancelled'));

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments"
ON public.appointments
FOR SELECT
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_appointments_clinician ON public.appointments(clinician_user_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_user_id);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_status ON public.appointments(status);