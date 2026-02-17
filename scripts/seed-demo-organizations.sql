-- ============================================================
-- Demo Organizations Seed Script
-- ============================================================
-- Creates multiple organizations with different users to test
-- multi-tenancy and demonstrate organization isolation.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/seed-demo-organizations.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Create Demo Organizations
-- ============================================================

-- Organization 1: Lagos General Hospital (Healthcare Provider)
INSERT INTO public.organizations (id, name, slug, description, status, license_type, max_users, contact_email, contact_phone, address, city, state, country)
VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Lagos General Hospital',
  'lagos-general-hospital',
  'Premier healthcare facility providing comprehensive medical services in Lagos',
  'active',
  'premium',
  100,
  'info@lagosgeneral.ng',
  '+234-1-234-5678',
  '10 Marina Road',
  'Lagos',
  'Lagos State',
  'Nigeria'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

-- Organization 2: Abuja Medical Center (Healthcare Provider)
INSERT INTO public.organizations (id, name, slug, description, status, license_type, max_users, contact_email, contact_phone, address, city, state, country)
VALUES (
  '20000000-0000-0000-0000-000000000002'::uuid,
  'Abuja Medical Center',
  'abuja-medical-center',
  'Modern medical center offering specialized healthcare services',
  'active',
  'standard',
  50,
  'contact@abujamedical.ng',
  '+234-9-876-5432',
  '25 Independence Avenue',
  'Abuja',
  'Federal Capital Territory',
  'Nigeria'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

-- Organization 3: HealthPlus Pharmacy Network (Pharmacy Chain)
INSERT INTO public.organizations (id, name, slug, description, status, license_type, max_users, contact_email, contact_phone, address, city, state, country)
VALUES (
  '30000000-0000-0000-0000-000000000003'::uuid,
  'HealthPlus Pharmacy Network',
  'healthplus-pharmacy',
  'Leading pharmacy chain with branches across Nigeria',
  'active',
  'enterprise',
  200,
  'support@healthplus.ng',
  '+234-1-555-0123',
  '42 Broad Street',
  'Lagos',
  'Lagos State',
  'Nigeria'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

-- Organization 4: Community Health Clinic (Small Clinic - Trial)
INSERT INTO public.organizations (id, name, slug, description, status, license_type, max_users, contact_email, contact_phone, address, city, state, country)
VALUES (
  '40000000-0000-0000-0000-000000000004'::uuid,
  'Community Health Clinic',
  'community-health-clinic',
  'Small community clinic providing basic healthcare services',
  'trial',
  'standard',
  10,
  'clinic@community-health.ng',
  '+234-803-555-9999',
  '15 Community Road',
  'Ibadan',
  'Oyo State',
  'Nigeria'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

-- ============================================================
-- 2. Create Organization Branding (White-labeling)
-- ============================================================

-- Lagos General Hospital Branding (Blue theme)
INSERT INTO public.organization_branding (id, organization_id, app_name, primary_color, secondary_color, accent_color, support_email, support_phone)
VALUES (
  '11000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Lagos General Portal',
  '210 100% 45%', -- Blue
  '220 90% 60%',
  '200 100% 50%',
  'support@lagosgeneral.ng',
  '+234-1-234-5678'
)
ON CONFLICT (organization_id) DO UPDATE SET
  app_name = EXCLUDED.app_name,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;

-- Abuja Medical Center Branding (Green theme)
INSERT INTO public.organization_branding (id, organization_id, app_name, primary_color, secondary_color, accent_color, support_email, support_phone)
VALUES (
  '22000000-0000-0000-0000-000000000002'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  'Abuja Medical Hub',
  '140 60% 45%', -- Green
  '160 55% 55%',
  '120 65% 50%',
  'help@abujamedical.ng',
  '+234-9-876-5432'
)
ON CONFLICT (organization_id) DO UPDATE SET
  app_name = EXCLUDED.app_name,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;

-- HealthPlus Pharmacy Branding (Purple/Pink theme)
INSERT INTO public.organization_branding (id, organization_id, app_name, primary_color, secondary_color, accent_color, support_email, support_phone)
VALUES (
  '33000000-0000-0000-0000-000000000003'::uuid,
  '30000000-0000-0000-0000-000000000003'::uuid,
  'HealthPlus Connect',
  '280 65% 50%', -- Purple
  '320 70% 60%',
  '340 80% 55%',
  'support@healthplus.ng',
  '+234-1-555-0123'
)
ON CONFLICT (organization_id) DO UPDATE SET
  app_name = EXCLUDED.app_name,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;

-- Community Health Clinic Branding (Orange theme)
INSERT INTO public.organization_branding (id, organization_id, app_name, primary_color, secondary_color, accent_color, support_email, support_phone)
VALUES (
  '44000000-0000-0000-0000-000000000004'::uuid,
  '40000000-0000-0000-0000-000000000004'::uuid,
  'Community Care Portal',
  '30 90% 55%', -- Orange
  '40 85% 60%',
  '20 95% 50%',
  'clinic@community-health.ng',
  '+234-803-555-9999'
)
ON CONFLICT (organization_id) DO UPDATE SET
  app_name = EXCLUDED.app_name,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color;

-- ============================================================
-- 3. Assign Users to Organizations (Organization Memberships)
-- ============================================================

-- Lagos General Hospital Members
-- Manager as owner
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid, 'owner', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- Clinician as admin
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'admin', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- Patients as members
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'member', true),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000001'::uuid, '71000000-0000-0000-0000-000000000001'::uuid, 'member', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- Abuja Medical Center Members
-- Dr. Okafor (clinician from seed data) as owner
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '20000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'owner', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- Different patient as member
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '20000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid, 'member', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- HealthPlus Pharmacy Network Members
-- Pharmacist as owner
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '30000000-0000-0000-0000-000000000003'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, 'owner', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- Pharmacist from seed data as admin
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '30000000-0000-0000-0000-000000000003'::uuid, 'f0000000-0000-0000-0000-000000000003'::uuid, 'admin', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- Community Health Clinic Members
-- Clinician as owner (small practice)
INSERT INTO public.organization_members (id, organization_id, user_id, org_role, is_active)
VALUES
  (gen_random_uuid(), '40000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'owner', true)
ON CONFLICT (organization_id, user_id) DO UPDATE SET org_role = EXCLUDED.org_role;

-- ============================================================
-- 4. Update User Profiles with Organization IDs
-- ============================================================

-- Assign users to their primary organizations in profiles table
UPDATE public.profiles SET organization_id = '10000000-0000-0000-0000-000000000001'::uuid
WHERE user_id IN (
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'b0000000-0000-0000-0000-000000000004'::uuid,
  '71000000-0000-0000-0000-000000000001'::uuid
);

UPDATE public.profiles SET organization_id = '20000000-0000-0000-0000-000000000002'::uuid
WHERE user_id IN (
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'd0000000-0000-0000-0000-000000000005'::uuid
);

UPDATE public.profiles SET organization_id = '30000000-0000-0000-0000-000000000003'::uuid
WHERE user_id IN (
  'f1000000-0000-0000-0000-000000000003'::uuid,
  'f0000000-0000-0000-0000-000000000003'::uuid
);

UPDATE public.profiles SET organization_id = '40000000-0000-0000-0000-000000000004'::uuid
WHERE user_id = 'c1000000-0000-0000-0000-000000000002'::uuid;

COMMIT;

-- ============================================================
-- Summary
-- ============================================================
SELECT 'Demo organizations created successfully!' as result;

-- Show created organizations
SELECT
  name,
  slug,
  status,
  license_type,
  (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = organizations.id) as member_count
FROM public.organizations
WHERE id IN (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  '30000000-0000-0000-0000-000000000003'::uuid,
  '40000000-0000-0000-0000-000000000004'::uuid
)
ORDER BY name;
