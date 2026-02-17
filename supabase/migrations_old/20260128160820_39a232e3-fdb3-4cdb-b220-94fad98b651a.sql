-- Fix the manager profiles policies to use user_id instead of id
DROP POLICY IF EXISTS "Managers can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update org profiles" ON public.profiles;

CREATE POLICY "Managers can view org profiles" 
ON public.profiles 
FOR SELECT 
USING (manager_can_access_user(auth.uid(), user_id));

CREATE POLICY "Managers can update org profiles" 
ON public.profiles 
FOR UPDATE 
USING (manager_can_access_user(auth.uid(), user_id));