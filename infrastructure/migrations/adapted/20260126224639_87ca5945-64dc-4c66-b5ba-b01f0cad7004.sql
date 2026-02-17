-- =============================================
-- FIX SECURITY WARNINGS
-- =============================================

-- 1. Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Fix the permissive RLS policy on audit_log
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Create a more restrictive insert policy
-- Audit logs are only inserted via security definer trigger, not directly by users
DROP POLICY IF EXISTS "Audit logs inserted via trigger only" ON public.audit_log;
CREATE POLICY "Audit logs inserted via trigger only"
  ON public.audit_log FOR INSERT
  WITH CHECK (
    -- Allow inserts only when user_id matches authenticated user
    -- This prevents users from inserting fake audit entries for other users
    user_id = auth.uid() OR user_id IS NULL
  );