-- ============================================================
-- Expand profiles_with_email view to include ALL profile columns
-- plus email (from auth.users) and organization name (from organizations)
-- ============================================================

CREATE OR REPLACE VIEW public.profiles_with_email AS
SELECT p.*, u.email, o.name AS organization
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id
LEFT JOIN public.organizations o ON p.organization_id = o.id;

-- Ensure access is granted
GRANT SELECT ON public.profiles_with_email TO authenticated;
