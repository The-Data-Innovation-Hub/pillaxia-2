-- ============================================================
-- Pillaxia Dev Data Seed Script for Azure PostgreSQL
-- ============================================================
-- Creates test users, roles, assignments, medications, schedules,
-- pharmacy data, and notification preferences for development.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/seed-azure-dev-data.sql
--
-- Prerequisites:
--   All migration scripts must have been run first.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Test Users (5 users with different roles)
-- ============================================================
-- Using deterministic UUIDs for reproducibility

-- Admin user
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'admin@pillaxia-dev.com',
   '{"name": "Admin User", "given_name": "Admin", "family_name": "User"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Clinician user
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'dr.okafor@pillaxia-dev.com',
   '{"name": "Dr. Chidi Okafor", "given_name": "Chidi", "family_name": "Okafor"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Pharmacist user
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('f0000000-0000-0000-0000-000000000003'::uuid, 'pharm.adeyemi@pillaxia-dev.com',
   '{"name": "Funke Adeyemi", "given_name": "Funke", "family_name": "Adeyemi"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Patient user 1
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000004'::uuid, 'patient.bola@pillaxia-dev.com',
   '{"name": "Bola Adesanya", "given_name": "Bola", "family_name": "Adesanya"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Patient user 2
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('d0000000-0000-0000-0000-000000000005'::uuid, 'patient.dayo@pillaxia-dev.com',
   '{"name": "Dayo Eze", "given_name": "Dayo", "family_name": "Eze"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- ============================================================
-- 2. Profiles
-- ============================================================

INSERT INTO public.profiles (id, user_id, first_name, last_name, phone, language_preference, timezone)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001'::uuid, 'Admin', 'User', '+2340000000001', 'en', 'Africa/Lagos'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'Chidi', 'Okafor', '+2340000000002', 'en', 'Africa/Lagos'),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003'::uuid, 'Funke', 'Adeyemi', '+2340000000003', 'yo', 'Africa/Lagos'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Bola', 'Adesanya', '+2340000000004', 'en', 'Africa/Lagos'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, 'Dayo', 'Eze', '+2340000000005', 'ig', 'Africa/Lagos')
ON CONFLICT (user_id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone;

-- ============================================================
-- 3. User Roles
-- ============================================================

INSERT INTO public.user_roles (id, user_id, role) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001'::uuid, 'admin'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'clinician'),
  (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003'::uuid, 'pharmacist'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'patient'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, 'patient')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- 4. Clinician-Patient Assignments
-- ============================================================

INSERT INTO public.clinician_patient_assignments (id, clinician_user_id, patient_user_id, notes)
VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'Primary care physician'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid, 'Referred for hypertension management')
ON CONFLICT (clinician_user_id, patient_user_id) DO NOTHING;

-- ============================================================
-- 5. Pharmacy Location
-- ============================================================

INSERT INTO public.pharmacy_locations (id, pharmacist_user_id, name, address_line1, city, state, country, phone, email)
VALUES
  ('e0000000-0000-0000-0000-000000000010'::uuid, 'f0000000-0000-0000-0000-000000000003'::uuid,
   'Adeyemi Pharmacy', '42 Broad Street', 'Lagos', 'Lagos', 'Nigeria',
   '+2341234567890', 'info@adeyemipharmacy.ng')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- 6. Medication Catalog
-- ============================================================

INSERT INTO public.medication_catalog (id, name, generic_name, dosage, dosage_unit, form, manufacturer)
VALUES
  ('m0000000-0000-0000-0000-000000000001'::uuid, 'Amlodipine', 'Amlodipine Besylate', '5', 'mg', 'tablet', 'Pfizer'),
  ('m0000000-0000-0000-0000-000000000002'::uuid, 'Metformin', 'Metformin Hydrochloride', '500', 'mg', 'tablet', 'Merck'),
  ('m0000000-0000-0000-0000-000000000003'::uuid, 'Lisinopril', 'Lisinopril', '10', 'mg', 'tablet', 'AstraZeneca'),
  ('m0000000-0000-0000-0000-000000000004'::uuid, 'Amoxicillin', 'Amoxicillin Trihydrate', '500', 'mg', 'capsule', 'GSK'),
  ('m0000000-0000-0000-0000-000000000005'::uuid, 'Ibuprofen', 'Ibuprofen', '400', 'mg', 'tablet', 'Abbott')
ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;

-- ============================================================
-- 7. Patient Medications (for patient Bola)
-- ============================================================

INSERT INTO public.medications (id, user_id, name, dosage, dosage_unit, form, instructions, prescriber_user_id, pharmacy_id, is_active, prescription_status, refills_remaining, start_date)
VALUES
  ('med00000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Amlodipine', '5', 'mg', 'tablet', 'Take once daily in the morning with water',
   'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   true, 'ready', 3, CURRENT_DATE - INTERVAL '30 days'),
  ('med00000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Metformin', '500', 'mg', 'tablet', 'Take twice daily with meals',
   'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   true, 'ready', 5, CURRENT_DATE - INTERVAL '60 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Patient Dayo medications
INSERT INTO public.medications (id, user_id, name, dosage, dosage_unit, form, instructions, prescriber_user_id, pharmacy_id, is_active, prescription_status, refills_remaining, start_date)
VALUES
  ('med00000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid,
   'Lisinopril', '10', 'mg', 'tablet', 'Take once daily',
   'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   true, 'ready', 2, CURRENT_DATE - INTERVAL '14 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- 8. Medication Schedules
-- ============================================================

INSERT INTO public.medication_schedules (id, medication_id, time_of_day, days_of_week, quantity, with_food, is_active)
VALUES
  (gen_random_uuid(), 'med00000-0000-0000-0000-000000000001'::uuid, '08:00', ARRAY[0,1,2,3,4,5,6], 1, false, true),
  (gen_random_uuid(), 'med00000-0000-0000-0000-000000000002'::uuid, '08:00', ARRAY[0,1,2,3,4,5,6], 1, true, true),
  (gen_random_uuid(), 'med00000-0000-0000-0000-000000000002'::uuid, '18:00', ARRAY[0,1,2,3,4,5,6], 1, true, true),
  (gen_random_uuid(), 'med00000-0000-0000-0000-000000000003'::uuid, '09:00', ARRAY[0,1,2,3,4,5,6], 1, false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Sample Medication Logs (last 7 days for Bola)
-- ============================================================

INSERT INTO public.medication_logs (id, schedule_id, medication_id, user_id, scheduled_time, taken_at, status)
SELECT
  gen_random_uuid(),
  ms.id,
  ms.medication_id,
  m.user_id,
  (CURRENT_DATE - (d || ' days')::interval + ms.time_of_day)::timestamptz,
  CASE WHEN random() > 0.15 -- 85% adherence rate
    THEN (CURRENT_DATE - (d || ' days')::interval + ms.time_of_day + (random() * INTERVAL '30 minutes'))::timestamptz
    ELSE NULL
  END,
  CASE WHEN random() > 0.15 THEN 'taken' ELSE 'missed' END
FROM public.medication_schedules ms
JOIN public.medications m ON ms.medication_id = m.id
CROSS JOIN generate_series(0, 6) AS d
WHERE m.user_id = 'b0000000-0000-0000-0000-000000000004'::uuid
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Patient Notification Preferences
-- ============================================================

INSERT INTO public.patient_notification_preferences (id, user_id, email_reminders, sms_reminders, in_app_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, true, true, true, true, '22:00', '07:00'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, true, false, true, false, '22:00', '07:00')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 11. Medication Availability at Adeyemi Pharmacy
-- ============================================================

INSERT INTO public.medication_availability (id, pharmacy_id, medication_catalog_id, medication_name, is_available, quantity_available, price_naira)
VALUES
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, 'm0000000-0000-0000-0000-000000000001'::uuid, 'Amlodipine 5mg', true, 500, 150.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, 'm0000000-0000-0000-0000-000000000002'::uuid, 'Metformin 500mg', true, 1000, 200.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, 'm0000000-0000-0000-0000-000000000003'::uuid, 'Lisinopril 10mg', true, 300, 250.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, 'm0000000-0000-0000-0000-000000000004'::uuid, 'Amoxicillin 500mg', true, 200, 100.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, 'm0000000-0000-0000-0000-000000000005'::uuid, 'Ibuprofen 400mg', false, 0, 80.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. Sample Chronic Conditions (patient Bola)
-- ============================================================

INSERT INTO public.patient_chronic_conditions (id, user_id, condition_name, diagnosed_date, is_active)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Hypertension', '2024-03-15', true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Type 2 Diabetes', '2024-06-20', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. Sample Vital Signs (patient Bola - last 5 readings)
-- ============================================================

INSERT INTO public.patient_vitals (id, user_id, recorded_at, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight, blood_glucose, is_fasting)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '5 days', 142, 88, 78, 36.6, 82.5, 145, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '4 days', 138, 85, 76, 36.5, 82.3, 132, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '3 days', 135, 84, 74, 36.7, 82.0, 128, false),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '2 days', 132, 82, 72, 36.6, 81.8, 125, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '1 day', 130, 80, 70, 36.5, 81.5, 120, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 14. Drug Interaction Data
-- ============================================================

INSERT INTO public.drug_interactions (id, drug_a, drug_b, severity, description, recommendation)
VALUES
  (gen_random_uuid(), 'Metformin', 'Ibuprofen', 'moderate', 'NSAIDs may reduce the effectiveness of Metformin and increase the risk of lactic acidosis.', 'Monitor blood glucose levels closely when using together. Consider alternative pain relief.'),
  (gen_random_uuid(), 'Lisinopril', 'Ibuprofen', 'moderate', 'NSAIDs may reduce the blood pressure-lowering effect of ACE inhibitors and increase risk of kidney impairment.', 'Avoid prolonged use of NSAIDs with ACE inhibitors. Monitor blood pressure and kidney function.'),
  (gen_random_uuid(), 'Amlodipine', 'Metformin', 'mild', 'No clinically significant interaction expected. Both medications can be safely used together.', 'No dose adjustment required.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 15. Sample Appointment
-- ============================================================

INSERT INTO public.appointments (id, clinician_user_id, patient_user_id, title, description, appointment_date, appointment_time, duration_minutes, status)
VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Follow-up: Hypertension Review', 'Monthly blood pressure check and medication review',
   CURRENT_DATE + INTERVAL '7 days', '10:00', 30, 'scheduled')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Done
-- ============================================================

COMMIT;

-- Print summary
DO $$
DECLARE
  v_users INTEGER;
  v_profiles INTEGER;
  v_roles INTEGER;
  v_meds INTEGER;
  v_schedules INTEGER;
  v_logs INTEGER;
  v_pharmacies INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users FROM public.users;
  SELECT COUNT(*) INTO v_profiles FROM public.profiles;
  SELECT COUNT(*) INTO v_roles FROM public.user_roles;
  SELECT COUNT(*) INTO v_meds FROM public.medications;
  SELECT COUNT(*) INTO v_schedules FROM public.medication_schedules;
  SELECT COUNT(*) INTO v_logs FROM public.medication_logs;
  SELECT COUNT(*) INTO v_pharmacies FROM public.pharmacy_locations;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Dev Data Seed Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Users:       %', v_users;
  RAISE NOTICE '  Profiles:    %', v_profiles;
  RAISE NOTICE '  Roles:       %', v_roles;
  RAISE NOTICE '  Medications: %', v_meds;
  RAISE NOTICE '  Schedules:   %', v_schedules;
  RAISE NOTICE '  Med logs:    %', v_logs;
  RAISE NOTICE '  Pharmacies:  %', v_pharmacies;
  RAISE NOTICE '========================================';
END $$;
