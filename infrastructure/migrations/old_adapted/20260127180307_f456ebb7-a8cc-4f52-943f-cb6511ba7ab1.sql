-- Create table for patient engagement scores
CREATE TABLE IF NOT EXISTS public.patient_engagement_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  adherence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  app_usage_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  notification_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);

-- Create table for tracking patient activity/app usage
CREATE TABLE IF NOT EXISTS public.patient_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_engagement_scores_user_date ON public.patient_engagement_scores(user_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_scores_risk ON public.patient_engagement_scores(risk_level, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.patient_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON public.patient_activity_log(activity_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.patient_engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for engagement scores
DROP POLICY IF EXISTS "Users can view own engagement scores" ON public.patient_engagement_scores;
CREATE POLICY "Users can view own engagement scores"
ON public.patient_engagement_scores
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient scores" ON public.patient_engagement_scores;
CREATE POLICY "Clinicians can view assigned patient scores"
ON public.patient_engagement_scores
FOR SELECT
USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can view all engagement scores" ON public.patient_engagement_scores;
CREATE POLICY "Admins can view all engagement scores"
ON public.patient_engagement_scores
FOR SELECT
USING (is_admin(auth.uid()));

-- RLS Policies for activity log
DROP POLICY IF EXISTS "Users can insert own activity" ON public.patient_activity_log;
CREATE POLICY "Users can insert own activity"
ON public.patient_activity_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own activity" ON public.patient_activity_log;
CREATE POLICY "Users can view own activity"
ON public.patient_activity_log
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clinicians can view assigned patient activity" ON public.patient_activity_log;
CREATE POLICY "Clinicians can view assigned patient activity"
ON public.patient_activity_log
FOR SELECT
USING (is_clinician_assigned(user_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can view all activity" ON public.patient_activity_log;
CREATE POLICY "Admins can view all activity"
ON public.patient_activity_log
FOR SELECT
USING (is_admin(auth.uid()));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_engagement_scores_updated_at ON public.patient_engagement_scores;
CREATE TRIGGER update_engagement_scores_updated_at
BEFORE UPDATE ON public.patient_engagement_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();