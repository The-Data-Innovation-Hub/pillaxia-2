-- Drop the overly permissive insert policy and replace with service role only approach
-- The edge function uses service role key which bypasses RLS anyway
DROP POLICY IF EXISTS "System can insert login locations" ON public.user_login_locations;