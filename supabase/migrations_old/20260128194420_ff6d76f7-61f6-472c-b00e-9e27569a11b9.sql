-- Fix login_attempts INSERT policy to only allow inserts through the security definer function
-- This prevents authenticated users from directly inserting fake login attempt records

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;

-- The record_login_attempt function is already SECURITY DEFINER, so it can insert
-- No direct INSERT policy needed - all inserts should go through the function
-- If we need the function to work, we could add a more restrictive policy,
-- but since the function is SECURITY DEFINER it bypasses RLS anyway

-- Add a policy that prevents all direct inserts (function uses SECURITY DEFINER to bypass)
-- This ensures no authenticated user can directly insert records
CREATE POLICY "No direct inserts allowed"
  ON public.login_attempts FOR INSERT
  WITH CHECK (false);