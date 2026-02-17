-- ============================================================
-- Pillaxia Demo / Dev Data Seed Script for Azure PostgreSQL
-- ============================================================
-- Creates test users, roles, and demo data for ALL screens so
-- you can demonstrate how the platform works. Data is clearly
-- for demonstration (use with Demo banner in app).
--
-- Usage (from repo root, in a terminal where DATABASE_URL is set):
--   export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require'
--   ./scripts/run-seed.sh
-- Or: psql "$DATABASE_URL" -f scripts/seed-azure-dev-data.sql
-- If psql asks for your local user password, DATABASE_URL was not set in that shell.
--
-- To give an existing user (e.g. your own) the same demo data:
--   psql "$DATABASE_URL" -v user_email='your@email.com' -f scripts/seed-demo-for-user.sql
-- (Run this script first; the user must already exist in public.users.)
--
-- Prerequisites:
--   All migration scripts must have been run first.
--   For Azure: public.users must exist (auth schema adaptation).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Test Users (5 users with different roles)
-- ============================================================
-- Using deterministic UUIDs for reproducibility

-- Admin user (platform-wide super admin)
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'pillaxia@thedatainnovationhub.com',
   '{"name": "Pillaxia Admin", "given_name": "Pillaxia", "family_name": "Admin"}'::jsonb)
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

-- Caregiver (family member for Bola)
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('60000000-0000-0000-0000-000000000006'::uuid, 'caregiver.titi@pillaxia-dev.com',
   '{"name": "Titi Adesanya", "given_name": "Titi", "family_name": "Adesanya"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Demo users (demo.pillaxia.com – see docs/DEMO_USERS.md for password)
INSERT INTO public.users (id, email, raw_user_meta_data) VALUES
  ('71000000-0000-0000-0000-000000000001'::uuid, 'patient@demo.pillaxia.com',
   '{"name": "Demo Patient", "given_name": "Demo", "family_name": "Patient"}'::jsonb),
  ('c1000000-0000-0000-0000-000000000002'::uuid, 'clinician@demo.pillaxia.com',
   '{"name": "Demo Clinician", "given_name": "Demo", "family_name": "Clinician"}'::jsonb),
  ('f1000000-0000-0000-0000-000000000003'::uuid, 'pharmacist@demo.pillaxia.com',
   '{"name": "Demo Pharmacist", "given_name": "Demo", "family_name": "Pharmacist"}'::jsonb),
  ('a1000000-0000-0000-0000-000000000001'::uuid, 'manager@demo.pillaxia.com',
   '{"name": "Demo Manager", "given_name": "Demo", "family_name": "Manager"}'::jsonb)
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
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, 'Dayo', 'Eze', '+2340000000005', 'ig', 'Africa/Lagos'),
  (gen_random_uuid(), '60000000-0000-0000-0000-000000000006'::uuid, 'Titi', 'Adesanya', '+2340000000006', 'en', 'Africa/Lagos'),
  (gen_random_uuid(), '71000000-0000-0000-0000-000000000001'::uuid, 'Demo', 'Patient', NULL, 'en', 'UTC'),
  (gen_random_uuid(), 'c1000000-0000-0000-0000-000000000002'::uuid, 'Demo', 'Clinician', NULL, 'en', 'UTC'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000003'::uuid, 'Demo', 'Pharmacist', NULL, 'en', 'UTC'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001'::uuid, 'Demo', 'Manager', NULL, 'en', 'UTC')
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
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, 'patient'),
  (gen_random_uuid(), '60000000-0000-0000-0000-000000000006'::uuid, 'patient'),
  (gen_random_uuid(), '71000000-0000-0000-0000-000000000001'::uuid, 'patient'),
  (gen_random_uuid(), 'c1000000-0000-0000-0000-000000000002'::uuid, 'clinician'),
  (gen_random_uuid(), 'f1000000-0000-0000-0000-000000000003'::uuid, 'pharmacist'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001'::uuid, 'manager')
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
  ('0a000000-0000-0000-0000-000000000001'::uuid, 'Amlodipine', 'Amlodipine Besylate', '5', 'mg', 'tablet', 'Pfizer'),
  ('0a000000-0000-0000-0000-000000000002'::uuid, 'Metformin', 'Metformin Hydrochloride', '500', 'mg', 'tablet', 'Merck'),
  ('0a000000-0000-0000-0000-000000000003'::uuid, 'Lisinopril', 'Lisinopril', '10', 'mg', 'tablet', 'AstraZeneca'),
  ('0a000000-0000-0000-0000-000000000004'::uuid, 'Amoxicillin', 'Amoxicillin Trihydrate', '500', 'mg', 'capsule', 'GSK'),
  ('0a000000-0000-0000-0000-000000000005'::uuid, 'Ibuprofen', 'Ibuprofen', '400', 'mg', 'tablet', 'Abbott')
ON CONFLICT (name, dosage, dosage_unit, form) DO NOTHING;

-- ============================================================
-- 7. Patient Medications (for patient Bola)
-- ============================================================

INSERT INTO public.medications (id, user_id, name, dosage, dosage_unit, form, instructions, prescriber_user_id, pharmacy_id, is_active, prescription_status, refills_remaining, start_date)
VALUES
  ('0ed00000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Amlodipine', '5', 'mg', 'tablet', 'Take once daily in the morning with water',
   'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   true, 'ready', 3, CURRENT_DATE - INTERVAL '30 days'),
  ('0ed00000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Metformin', '500', 'mg', 'tablet', 'Take twice daily with meals',
   'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   true, 'ready', 5, CURRENT_DATE - INTERVAL '60 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Patient Dayo medications
INSERT INTO public.medications (id, user_id, name, dosage, dosage_unit, form, instructions, prescriber_user_id, pharmacy_id, is_active, prescription_status, refills_remaining, start_date)
VALUES
  ('0ed00000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid,
   'Lisinopril', '10', 'mg', 'tablet', 'Take once daily',
   'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   true, 'ready', 2, CURRENT_DATE - INTERVAL '14 days')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- 8. Medication Schedules
-- ============================================================

-- medication_schedules: include user_id if column exists (Azure may not have dropped it yet)
INSERT INTO public.medication_schedules (id, medication_id, user_id, time_of_day, days_of_week, quantity, with_food, is_active)
VALUES
  (gen_random_uuid(), '0ed00000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, '08:00', ARRAY[0,1,2,3,4,5,6], 1, false, true),
  (gen_random_uuid(), '0ed00000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, '08:00', ARRAY[0,1,2,3,4,5,6], 1, true, true),
  (gen_random_uuid(), '0ed00000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, '18:00', ARRAY[0,1,2,3,4,5,6], 1, true, true),
  (gen_random_uuid(), '0ed00000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid, '09:00', ARRAY[0,1,2,3,4,5,6], 1, false, true)
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
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, '0a000000-0000-0000-0000-000000000001'::uuid, 'Amlodipine 5mg', true, 500, 150.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, '0a000000-0000-0000-0000-000000000002'::uuid, 'Metformin 500mg', true, 1000, 200.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, '0a000000-0000-0000-0000-000000000003'::uuid, 'Lisinopril 10mg', true, 300, 250.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, '0a000000-0000-0000-0000-000000000004'::uuid, 'Amoxicillin 500mg', true, 200, 100.00),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000010'::uuid, '0a000000-0000-0000-0000-000000000005'::uuid, 'Ibuprofen 400mg', false, 0, 80.00)
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

INSERT INTO public.patient_vitals (id, user_id, recorded_at, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight, height, blood_glucose, is_fasting)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '5 days', 142, 88, 78, 36.6, 82.5, 170, 145, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '4 days', 138, 85, 76, 36.5, 82.3, 170, 132, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '3 days', 135, 84, 74, 36.7, 82.0, 170, 128, false),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '2 days', 132, 82, 72, 36.6, 81.8, 170, 125, true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, now() - INTERVAL '1 day', 130, 80, 70, 36.5, 81.5, 170, 120, true)
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
   CURRENT_DATE + INTERVAL '7 days', '10:00', 30, 'scheduled'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Diabetes Review', 'HbA1c and medication adherence check',
   CURRENT_DATE + INTERVAL '14 days', '14:00', 20, 'scheduled'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000005'::uuid,
   'Hypertension Follow-up', 'BP monitoring',
   CURRENT_DATE + INTERVAL '3 days', '09:30', 15, 'scheduled')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 16. Symptom entries (patient Bola and Dayo)
-- ============================================================

INSERT INTO public.symptom_entries (id, user_id, symptom_type, severity, description, recorded_at)
VALUES
  ('50000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'Headache', 4, 'Mild morning headache', now() - INTERVAL '2 days'),
  ('50000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'Dizziness', 6, 'Felt lightheaded after standing', now() - INTERVAL '1 day'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Fatigue', 3, 'Tired in afternoon', now() - INTERVAL '5 days'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, 'Headache', 5, 'Tension headache', now() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 17. Prescriptions (Bola)
-- ============================================================

INSERT INTO public.prescriptions (id, prescription_number, patient_user_id, clinician_user_id, pharmacy_id, medication_name, generic_name, dosage, dosage_unit, form, quantity, refills_authorized, refills_remaining, sig, instructions, date_written, status)
VALUES
  (gen_random_uuid(), 'RX-DEMO-001', 'b0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   'Amlodipine', 'Amlodipine Besylate', '5', 'mg', 'tablet', 30, 3, 3, 'Take 1 tablet by mouth once daily in the morning', 'Take with water', CURRENT_DATE - 30, 'ready'),
  (gen_random_uuid(), 'RX-DEMO-002', 'b0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
   'Metformin', 'Metformin HCl', '500', 'mg', 'tablet', 60, 5, 5, 'Take 1 tablet by mouth twice daily with meals', NULL, CURRENT_DATE - 60, 'dispensed')
ON CONFLICT (prescription_number) DO NOTHING;

-- ============================================================
-- 18. Refill requests
-- ============================================================

INSERT INTO public.refill_requests (id, patient_user_id, medication_id, status, patient_notes, created_at)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, id, 'pending', 'Running low, need refill before trip', now()
  FROM public.medications WHERE user_id = 'b0000000-0000-0000-0000-000000000004'::uuid AND name = 'Amlodipine' LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================
-- 19. Caregiver invitations (Bola invited Titi; accepted)
-- ============================================================

INSERT INTO public.caregiver_invitations (id, patient_user_id, caregiver_email, caregiver_user_id, status, permissions)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'caregiver.titi@pillaxia-dev.com', '60000000-0000-0000-0000-000000000006'::uuid, 'accepted', '{"view_medications": true, "view_adherence": true, "view_symptoms": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 20. Caregiver messages (Titi <-> Bola)
-- ============================================================

INSERT INTO public.caregiver_messages (id, caregiver_user_id, patient_user_id, message, is_read, created_at)
VALUES
  (gen_random_uuid(), '60000000-0000-0000-0000-000000000006'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'Remember to take your morning pills! I noticed you missed one yesterday.', true, now() - INTERVAL '1 day'),
  (gen_random_uuid(), '60000000-0000-0000-0000-000000000006'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'How are you feeling after starting the new dosage?', false, now() - INTERVAL '5 hours')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 21. Clinician messages (Dr. Okafor <-> Bola)
-- ============================================================

INSERT INTO public.clinician_messages (id, clinician_user_id, patient_user_id, message, sender_type, is_read, created_at)
VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'Your recent BP readings look good. Keep up the consistency with your medications.', 'clinician', true, now() - INTERVAL '2 days'),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'Please log any dizziness or headaches in the app so we can review at your next visit.', 'clinician', false, now() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 22. Notification history (demo deliveries)
-- ============================================================

INSERT INTO public.notification_history (id, user_id, channel, notification_type, title, body, status, created_at)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'push', 'medication_reminder', 'Time for Amlodipine', 'Take your 5 mg tablet now', 'sent', now() - INTERVAL '2 hours'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'email', 'medication_reminder', 'Daily medication reminder', 'You have 2 medications due today.', 'sent', now() - INTERVAL '1 day'),
  (gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, 'in_app', 'appointment_reminder', 'Appointment tomorrow', 'Hypertension Follow-up at 09:30', 'sent', now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 23. Security settings (global)
-- ============================================================

INSERT INTO public.security_settings (id, setting_key, setting_value, description)
VALUES
  (gen_random_uuid(), 'session_timeout_minutes', '{"value": 30}'::jsonb, 'Auto-logout after inactivity (minutes)'),
  (gen_random_uuid(), 'max_concurrent_sessions', '{"value": 3}'::jsonb, 'Max simultaneous sessions per user')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- ============================================================
-- 24. Patient engagement scores (last 7 days)
-- ============================================================

INSERT INTO public.patient_engagement_scores (id, user_id, score_date, adherence_score, app_usage_score, notification_score, overall_score, risk_level)
SELECT gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, (CURRENT_DATE - d), 75 + (d * 2), 80, 90, 82 + d, CASE WHEN d > 4 THEN 'low' ELSE 'medium' END
  FROM generate_series(0, 6) AS d
ON CONFLICT (user_id, score_date) DO NOTHING;

INSERT INTO public.patient_engagement_scores (id, user_id, score_date, adherence_score, app_usage_score, notification_score, overall_score, risk_level)
SELECT gen_random_uuid(), 'd0000000-0000-0000-0000-000000000005'::uuid, (CURRENT_DATE - d), 60 + d, 70, 85, 72, 'medium'
  FROM generate_series(0, 6) AS d
ON CONFLICT (user_id, score_date) DO NOTHING;

-- ============================================================
-- 25. Patient activity log
-- ============================================================

INSERT INTO public.patient_activity_log (id, user_id, activity_type, activity_data, created_at)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'medication_taken', '{"medication_id": "0ed00000-0000-0000-0000-000000000001"}'::jsonb, now() - INTERVAL '2 hours'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'symptom_logged', '{"symptom_type": "Headache"}'::jsonb, now() - INTERVAL '1 day'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'vitals_logged', '{}'::jsonb, now() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 26. Patient allergies and emergency contacts (Bola)
-- ============================================================

INSERT INTO public.patient_allergies (id, user_id, allergen, reaction_type, reaction_description, is_drug_allergy)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Penicillin', 'moderate', 'Rash and itching', true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Sulfa drugs', 'mild', 'Mild rash', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.patient_emergency_contacts (id, user_id, name, relationship, phone, email, is_primary)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Titi Adesanya', 'Spouse', '+2348000000006', 'caregiver.titi@pillaxia-dev.com', true),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'Dr. Chidi Okafor', 'Physician', '+2340000000002', 'dr.okafor@pillaxia-dev.com', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 27. Lab results (Bola)
-- ============================================================

INSERT INTO public.lab_results (id, user_id, ordered_by, test_name, test_code, category, result_value, result_unit, reference_range, status, is_abnormal, abnormal_flag, ordered_at, resulted_at)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'HbA1c', '83036', 'blood', '7.2', '%', '4.0-5.6', 'completed', true, 'high', now() - INTERVAL '14 days', now() - INTERVAL '12 days'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'Fasting glucose', '82947', 'blood', '128', 'mg/dL', '70-100', 'completed', true, 'high', now() - INTERVAL '14 days', now() - INTERVAL '12 days'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'Creatinine', '82570', 'blood', '0.9', 'mg/dL', '0.7-1.3', 'completed', false, 'normal', now() - INTERVAL '14 days', now() - INTERVAL '12 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 28. SOAP notes (clinician for Bola)
-- ============================================================

INSERT INTO public.soap_notes (id, clinician_user_id, patient_user_id, subjective, objective, assessment, plan, visit_date)
VALUES
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Patient reports better BP control. Occasional morning headache.', 'BP 132/82, HR 72. Weight 81.8 kg.', 'Hypertension and T2DM well controlled on current regimen.', 'Continue current medications. Recheck HbA1c in 3 months.', CURRENT_DATE - 7),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid,
   'Compliant with medications. No new symptoms.', 'BP 130/80. Fasting glucose improved.', 'Good adherence. Diabetes improving.', 'Continue Metformin and Amlodipine. Follow up in 4 weeks.', CURRENT_DATE - 30)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 29. Red flag alert (clinician dashboard – severe symptom)
-- ============================================================

INSERT INTO public.red_flag_alerts (id, patient_user_id, clinician_user_id, symptom_entry_id, alert_type, severity, symptom_type, description, is_acknowledged)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, '50000000-0000-0000-0000-000000000002'::uuid, 'severe_symptom', 6, 'Dizziness', 'Patient reported lightheadedness after standing. Consider orthostatic BP check.', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 30. Patient preferred pharmacies (Bola)
-- ============================================================

INSERT INTO public.patient_preferred_pharmacies (id, patient_user_id, pharmacy_id, is_primary)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid, true)
ON CONFLICT (patient_user_id, pharmacy_id) DO NOTHING;

-- ============================================================
-- 31. Second pharmacy (for map and variety)
-- ============================================================

INSERT INTO public.pharmacy_locations (id, pharmacist_user_id, name, address_line1, city, state, country, phone, email, is_active)
VALUES
  ('e0000000-0000-0000-0000-000000000011'::uuid, 'f0000000-0000-0000-0000-000000000003'::uuid,
   'HealthPlus Lagos', '15 Marina Street', 'Lagos', 'Lagos', 'Nigeria',
   '+2341234567891', 'contact@healthplus.ng', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================
-- Done
-- ============================================================

COMMIT;

-- Print summary
DO $$
DECLARE
  v_users INTEGER;
  v_profiles INTEGER;
  v_meds INTEGER;
  v_logs INTEGER;
  v_pharmacies INTEGER;
  v_symptoms INTEGER;
  v_prescriptions INTEGER;
  v_appointments INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users FROM public.users;
  SELECT COUNT(*) INTO v_profiles FROM public.profiles;
  SELECT COUNT(*) INTO v_meds FROM public.medications;
  SELECT COUNT(*) INTO v_logs FROM public.medication_logs;
  SELECT COUNT(*) INTO v_pharmacies FROM public.pharmacy_locations;
  SELECT COUNT(*) INTO v_symptoms FROM public.symptom_entries;
  SELECT COUNT(*) INTO v_prescriptions FROM public.prescriptions;
  SELECT COUNT(*) INTO v_appointments FROM public.appointments;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Demo / Dev Data Seed Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  Users:        %', v_users;
  RAISE NOTICE '  Profiles:     %', v_profiles;
  RAISE NOTICE '  Medications:  %', v_meds;
  RAISE NOTICE '  Med logs:     %', v_logs;
  RAISE NOTICE '  Pharmacies:   %', v_pharmacies;
  RAISE NOTICE '  Symptoms:     %', v_symptoms;
  RAISE NOTICE '  Prescriptions:%', v_prescriptions;
  RAISE NOTICE '  Appointments: %', v_appointments;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Demo accounts (pillaxia-dev.com): patient.bola@..., dr.okafor@..., admin@...';
  RAISE NOTICE 'Demo accounts (demo.pillaxia.com): patient@..., clinician@..., pharmacist@..., manager@...';
  RAISE NOTICE '  See docs/DEMO_USERS.md for demo.pillaxia.com usernames and password.';
  RAISE NOTICE '========================================';
END $$;
