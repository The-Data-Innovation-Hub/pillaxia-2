-- Create email A/B tests table
CREATE TABLE public.email_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  variant_a_subject TEXT NOT NULL,
  variant_a_preview TEXT,
  variant_b_subject TEXT NOT NULL,
  variant_b_preview TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create email A/B test assignments table (tracks which variant was sent to which notification)
CREATE TABLE public.email_ab_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.email_ab_tests(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES public.notification_history(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  user_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_ab_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_ab_tests (admin only)
CREATE POLICY "Admins can view all A/B tests"
ON public.email_ab_tests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can create A/B tests"
ON public.email_ab_tests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update A/B tests"
ON public.email_ab_tests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete A/B tests"
ON public.email_ab_tests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for email_ab_assignments (admin only for viewing)
CREATE POLICY "Admins can view all A/B assignments"
ON public.email_ab_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "System can insert A/B assignments"
ON public.email_ab_assignments
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_email_ab_tests_active ON public.email_ab_tests(is_active);
CREATE INDEX idx_email_ab_tests_notification_type ON public.email_ab_tests(notification_type);
CREATE INDEX idx_email_ab_assignments_test_id ON public.email_ab_assignments(test_id);
CREATE INDEX idx_email_ab_assignments_notification_id ON public.email_ab_assignments(notification_id);