-- Create video_rooms table for telemedicine sessions
CREATE TABLE public.video_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL UNIQUE,
  room_sid TEXT, -- Twilio room SID
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  clinician_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, waiting, in_progress, completed, cancelled
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  is_group_call BOOLEAN NOT NULL DEFAULT false,
  recording_enabled BOOLEAN NOT NULL DEFAULT false,
  recording_sid TEXT,
  recording_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_room_participants for tracking who joined
CREATE TABLE public.video_room_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.video_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  participant_type TEXT NOT NULL DEFAULT 'patient', -- clinician, patient, caregiver
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  is_in_waiting_room BOOLEAN NOT NULL DEFAULT true,
  admitted_at TIMESTAMP WITH TIME ZONE,
  admitted_by UUID,
  connection_quality TEXT, -- excellent, good, fair, poor
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video_call_notes for in-call clinical notes
CREATE TABLE public.video_call_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.video_rooms(id) ON DELETE CASCADE,
  clinician_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create post_call_summaries for patient-facing summaries
CREATE TABLE public.post_call_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.video_rooms(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  clinician_user_id UUID NOT NULL,
  summary TEXT NOT NULL,
  recommendations TEXT,
  follow_up_date DATE,
  prescriptions_written JSONB DEFAULT '[]'::jsonb,
  sent_to_patient BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create waiting_room_queue for queue management
CREATE TABLE public.waiting_room_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinician_user_id UUID NOT NULL,
  patient_user_id UUID NOT NULL,
  room_id UUID REFERENCES public.video_rooms(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal', -- urgent, high, normal, low
  reason_for_visit TEXT,
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  called_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, called, in_progress, completed, no_show
  estimated_wait_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add is_video_call column to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_video_call BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_room_id UUID REFERENCES public.video_rooms(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.video_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_call_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_call_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_room_queue ENABLE ROW LEVEL SECURITY;

-- RLS for video_rooms
CREATE POLICY "Clinicians can view their video rooms" ON public.video_rooms
  FOR SELECT USING (auth.uid() = clinician_user_id);

CREATE POLICY "Patients can view their video rooms" ON public.video_rooms
  FOR SELECT USING (auth.uid() = patient_user_id);

CREATE POLICY "Clinicians can create video rooms" ON public.video_rooms
  FOR INSERT WITH CHECK (auth.uid() = clinician_user_id AND is_clinician(auth.uid()));

CREATE POLICY "Clinicians can update their video rooms" ON public.video_rooms
  FOR UPDATE USING (auth.uid() = clinician_user_id);

CREATE POLICY "Admins can view all video rooms" ON public.video_rooms
  FOR SELECT USING (is_admin(auth.uid()));

-- RLS for video_room_participants
CREATE POLICY "Room participants can view participants" ON public.video_room_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.video_rooms 
      WHERE id = room_id 
      AND (clinician_user_id = auth.uid() OR patient_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert themselves as participants" ON public.video_room_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation" ON public.video_room_participants
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Clinicians can update participant status" ON public.video_room_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.video_rooms 
      WHERE id = room_id AND clinician_user_id = auth.uid()
    )
  );

-- RLS for video_call_notes
CREATE POLICY "Clinicians can manage their call notes" ON public.video_call_notes
  FOR ALL USING (auth.uid() = clinician_user_id);

CREATE POLICY "Patients can view finalized notes" ON public.video_call_notes
  FOR SELECT USING (auth.uid() = patient_user_id AND is_draft = false);

-- RLS for post_call_summaries
CREATE POLICY "Clinicians can manage summaries" ON public.post_call_summaries
  FOR ALL USING (auth.uid() = clinician_user_id);

CREATE POLICY "Patients can view their summaries" ON public.post_call_summaries
  FOR SELECT USING (auth.uid() = patient_user_id);

-- RLS for waiting_room_queue
CREATE POLICY "Clinicians can manage their queue" ON public.waiting_room_queue
  FOR ALL USING (auth.uid() = clinician_user_id);

CREATE POLICY "Patients can view their queue position" ON public.waiting_room_queue
  FOR SELECT USING (auth.uid() = patient_user_id);

CREATE POLICY "Patients can join queue" ON public.waiting_room_queue
  FOR INSERT WITH CHECK (auth.uid() = patient_user_id);

-- Enable realtime for waiting room and video rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiting_room_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_room_participants;

-- Create trigger for updated_at
CREATE TRIGGER update_video_rooms_updated_at
  BEFORE UPDATE ON public.video_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_call_notes_updated_at
  BEFORE UPDATE ON public.video_call_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();