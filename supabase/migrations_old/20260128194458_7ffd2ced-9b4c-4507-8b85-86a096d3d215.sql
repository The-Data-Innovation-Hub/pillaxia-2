-- Fix remaining overly permissive RLS policies

-- 1. Drop the permissive "System can manage lockouts" policy on account_lockouts
DROP POLICY IF EXISTS "System can manage lockouts" ON public.account_lockouts;

-- Add policy to block direct modifications (SECURITY DEFINER functions bypass RLS)
CREATE POLICY "No direct lockout modifications"
  ON public.account_lockouts FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No direct lockout updates"
  ON public.account_lockouts FOR UPDATE
  USING (false);

CREATE POLICY "No direct lockout deletes"
  ON public.account_lockouts FOR DELETE
  USING (false);

-- 2. Drop the permissive "System can insert A/B assignments" policy
DROP POLICY IF EXISTS "System can insert A/B assignments" ON public.email_ab_assignments;

-- Only admins should be able to insert A/B assignments
CREATE POLICY "Admins can insert A/B assignments"
  ON public.email_ab_assignments FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Add update/delete policies for admins
CREATE POLICY "Admins can update A/B assignments"
  ON public.email_ab_assignments FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete A/B assignments"
  ON public.email_ab_assignments FOR DELETE
  USING (is_admin(auth.uid()));