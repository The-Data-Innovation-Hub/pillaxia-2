-- ============================================================
-- Copy demo data to an existing user (by email)
-- ============================================================
-- Use this so the current user (e.g. your own account) sees the
-- same demo data as patient.bola@pillaxia-dev.com.
--
-- Prerequisites:
--   1. Run scripts/seed-azure-dev-data.sql first (creates demo
--      users, pharmacies, clinician, and Bola's data).
--   2. The target user must already exist in public.users (e.g.
--      signed up via the app / Entra).
--
-- Usage:
--   psql "$DATABASE_URL" -v user_email='your@email.com' -f scripts/seed-demo-for-user.sql
--
-- Example:
--   psql "postgresql://..." -v user_email='brendan@example.com' -f scripts/seed-demo-for-user.sql
-- ============================================================

\set QUIET on
-- Require user_email to be set (pass with -v user_email='...')
\if :{?user_email}
\else
\echo 'ERROR: Pass -v user_email=your@email.com'
\quit 1
\endif

BEGIN;

-- Resolve target user id (psql substitutes :'user_email' here)
CREATE TEMP TABLE IF NOT EXISTS _demo_target (user_id uuid);
DELETE FROM _demo_target;
INSERT INTO _demo_target (user_id)
  SELECT id FROM public.users WHERE email = :'user_email'
  LIMIT 1;

-- Abort if user not found (cannot use :'user_email' inside $$ so check row count)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _demo_target WHERE user_id IS NOT NULL;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No user found for that email. Create the user in the app first, then run: psql ... -v user_email=''your@email.com'' -f scripts/seed-demo-for-user.sql';
  END IF;
END $$;

-- Medication id mapping (old Bola med id -> new id for target user)
CREATE TEMP TABLE IF NOT EXISTS _demo_med_map (old_id uuid, new_id uuid);
DELETE FROM _demo_med_map;

-- Copy medications from Bola to target user and build mapping
DO $$
DECLARE
  v_target_id uuid;
  v_old_id uuid;
  v_new_id uuid;
  v_rec record;
  v_bola constant uuid := 'b0000000-0000-0000-0000-000000000004'::uuid;
  v_clinician constant uuid := 'c0000000-0000-0000-0000-000000000002'::uuid;
  v_pharmacy constant uuid := 'e0000000-0000-0000-0000-000000000010'::uuid;
BEGIN
  SELECT user_id INTO v_target_id FROM _demo_target LIMIT 1;

  FOR v_rec IN
    SELECT id, name, dosage, dosage_unit, form, instructions,
           is_active, prescription_status, refills_remaining, start_date
    FROM public.medications
    WHERE user_id = v_bola AND is_active = true
  LOOP
    v_new_id := gen_random_uuid();
    INSERT INTO public.medications (
      id, user_id, name, dosage, dosage_unit, form, instructions,
      prescriber_user_id, pharmacy_id, is_active, prescription_status,
      refills_remaining, start_date
    ) VALUES (
      v_new_id, v_target_id, v_rec.name, v_rec.dosage, v_rec.dosage_unit,
      v_rec.form, v_rec.instructions, v_clinician, v_pharmacy,
      v_rec.is_active, v_rec.prescription_status, v_rec.refills_remaining,
      v_rec.start_date
    )
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO _demo_med_map (old_id, new_id) VALUES (v_rec.id, v_new_id);
  END LOOP;
END $$;

-- Copy medication_schedules (using new medication ids)
-- Include user_id for Azure (column may be NOT NULL there)
INSERT INTO public.medication_schedules (id, medication_id, user_id, time_of_day, days_of_week, quantity, with_food, is_active)
SELECT gen_random_uuid(), m.new_id, t.user_id, ms.time_of_day, ms.days_of_week, ms.quantity, ms.with_food, ms.is_active
FROM _demo_target t
CROSS JOIN public.medication_schedules ms
JOIN _demo_med_map m ON ms.medication_id = m.old_id
WHERE ms.is_active = true
ON CONFLICT DO NOTHING;

-- Copy medication_logs (last 7 days pattern) for target user and new med ids
INSERT INTO public.medication_logs (id, schedule_id, medication_id, user_id, scheduled_time, taken_at, status)
SELECT gen_random_uuid(), ns.id, m.new_id, t.user_id,
  (CURRENT_DATE - (d || ' days')::interval + ns.time_of_day)::timestamptz,
  CASE WHEN random() > 0.2 THEN (CURRENT_DATE - (d || ' days')::interval + ns.time_of_day + (random() * INTERVAL '30 minutes'))::timestamptz ELSE NULL END,
  CASE WHEN random() > 0.2 THEN 'taken' ELSE 'missed' END
FROM _demo_target t
CROSS JOIN _demo_med_map m
JOIN public.medication_schedules ns ON ns.medication_id = m.new_id AND ns.is_active = true
CROSS JOIN generate_series(0, 6) AS d
ON CONFLICT DO NOTHING;

-- Copy symptom_entries
INSERT INTO public.symptom_entries (id, user_id, symptom_type, severity, description, recorded_at)
SELECT gen_random_uuid(), t.user_id, se.symptom_type, se.severity, se.description, se.recorded_at
FROM _demo_target t
CROSS JOIN (
  SELECT symptom_type, severity, description, recorded_at
  FROM public.symptom_entries
  WHERE user_id = 'b0000000-0000-0000-0000-000000000004'::uuid
  LIMIT 5
) se
ON CONFLICT DO NOTHING;

-- Copy patient_notification_preferences
INSERT INTO public.patient_notification_preferences (id, user_id, email_reminders, sms_reminders, in_app_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
SELECT gen_random_uuid(), t.user_id, true, true, true, true, '22:00', '07:00'
FROM _demo_target t
ON CONFLICT (user_id) DO NOTHING;

-- Copy patient_vitals (last 5 readings pattern)
INSERT INTO public.patient_vitals (id, user_id, recorded_at, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, weight, height, blood_glucose, is_fasting)
SELECT gen_random_uuid(), t.user_id,
  now() - (d || ' days')::interval, 140 - d*2, 88 - d, 78 - d, 36.5 + random()*0.3, 82 - d*0.2, 170, 140 - d*4, true
FROM _demo_target t
CROSS JOIN generate_series(1, 5) AS d
ON CONFLICT DO NOTHING;

-- Copy patient_engagement_scores (last 7 days)
INSERT INTO public.patient_engagement_scores (id, user_id, score_date, adherence_score, app_usage_score, notification_score, overall_score, risk_level)
SELECT gen_random_uuid(), t.user_id, CURRENT_DATE - d, 75 + (d * 2), 80, 90, 82 + d, 'low'
FROM _demo_target t
CROSS JOIN generate_series(0, 6) AS d
ON CONFLICT (user_id, score_date) DO NOTHING;

-- Copy patient_activity_log
INSERT INTO public.patient_activity_log (id, user_id, activity_type, activity_data, created_at)
SELECT gen_random_uuid(), t.user_id, 'medication_taken', '{}'::jsonb, now() - (d || ' hours')::interval
FROM _demo_target t
CROSS JOIN generate_series(1, 5) AS d
ON CONFLICT DO NOTHING;

-- Copy patient_allergies
INSERT INTO public.patient_allergies (id, user_id, allergen, reaction_type, reaction_description, is_drug_allergy)
SELECT gen_random_uuid(), t.user_id, 'Penicillin', 'moderate', 'Rash and itching', true FROM _demo_target t
UNION ALL
SELECT gen_random_uuid(), t.user_id, 'Sulfa drugs', 'mild', 'Mild rash', true FROM _demo_target t
ON CONFLICT DO NOTHING;

-- Copy patient_emergency_contacts
INSERT INTO public.patient_emergency_contacts (id, user_id, name, relationship, phone, email, is_primary)
SELECT gen_random_uuid(), t.user_id, 'Demo Contact', 'Family', '+2340000000000', 'demo@example.com', true
FROM _demo_target t
ON CONFLICT DO NOTHING;

-- Copy lab_results
INSERT INTO public.lab_results (id, user_id, ordered_by, test_name, test_code, category, result_value, result_unit, reference_range, status, is_abnormal, abnormal_flag, ordered_at, resulted_at)
SELECT gen_random_uuid(), t.user_id, 'c0000000-0000-0000-0000-000000000002'::uuid, 'HbA1c', '83036', 'blood', '7.2', '%', '4.0-5.6', 'completed', true, 'high', now() - INTERVAL '14 days', now() - INTERVAL '12 days'
FROM _demo_target t
ON CONFLICT DO NOTHING;

-- Copy patient_preferred_pharmacies
INSERT INTO public.patient_preferred_pharmacies (id, patient_user_id, pharmacy_id, is_primary)
SELECT gen_random_uuid(), t.user_id, 'e0000000-0000-0000-0000-000000000010'::uuid, true
FROM _demo_target t
ON CONFLICT (patient_user_id, pharmacy_id) DO NOTHING;

-- Clinician-patient assignment so clinician views can see this patient
INSERT INTO public.clinician_patient_assignments (id, clinician_user_id, patient_user_id, notes)
SELECT gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, t.user_id, 'Demo data copy'
FROM _demo_target t
ON CONFLICT (clinician_user_id, patient_user_id) DO NOTHING;

-- Appointments
INSERT INTO public.appointments (id, clinician_user_id, patient_user_id, title, description, appointment_date, appointment_time, duration_minutes, status)
SELECT gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002'::uuid, t.user_id,
  'Follow-up: Hypertension Review', 'Demo appointment', CURRENT_DATE + 7, '10:00', 30, 'scheduled'
FROM _demo_target t
ON CONFLICT DO NOTHING;

-- Prescriptions (unique prescription numbers)
INSERT INTO public.prescriptions (id, prescription_number, patient_user_id, clinician_user_id, pharmacy_id, medication_name, generic_name, dosage, dosage_unit, form, quantity, refills_authorized, refills_remaining, sig, instructions, date_written, status)
SELECT gen_random_uuid(), 'RX-DEMO-' || substr(gen_random_uuid()::text, 1, 8), t.user_id, 'c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000010'::uuid,
  'Amlodipine', 'Amlodipine Besylate', '5', 'mg', 'tablet', 30, 3, 3, 'Take 1 tablet once daily', NULL, CURRENT_DATE - 30, 'ready'
FROM _demo_target t
ON CONFLICT (prescription_number) DO NOTHING;

-- Refill request (one pending) - use first new med id for target
INSERT INTO public.refill_requests (id, patient_user_id, medication_id, status, patient_notes, created_at)
SELECT gen_random_uuid(), t.user_id, m.new_id, 'pending', 'Demo refill request', now()
FROM _demo_target t
CROSS JOIN (SELECT new_id FROM _demo_med_map LIMIT 1) m
ON CONFLICT DO NOTHING;

-- Notification history
INSERT INTO public.notification_history (id, user_id, channel, notification_type, title, body, status, created_at)
SELECT gen_random_uuid(), t.user_id, 'push', 'medication_reminder', 'Time for your medication', 'Demo reminder', 'sent', now() - INTERVAL '2 hours'
FROM _demo_target t
ON CONFLICT DO NOTHING;

COMMIT;

\echo 'Demo data copied successfully for email:' :user_email
\echo 'Refresh the dashboard to see medications, vitals, and other demo data.'
