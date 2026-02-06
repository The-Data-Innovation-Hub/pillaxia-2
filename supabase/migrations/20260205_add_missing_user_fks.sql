-- ============================================================
-- Add missing FK constraints to auth.users for user reference columns.
-- Uses DO $$ ... EXCEPTION WHEN duplicate_object ... pattern for idempotency.
-- ============================================================

-- patient_vitals.user_id
DO $$ BEGIN
  ALTER TABLE public.patient_vitals ADD CONSTRAINT fk_patient_vitals_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_vitals.recorded_by
DO $$ BEGIN
  ALTER TABLE public.patient_vitals ADD CONSTRAINT fk_patient_vitals_recorded_by
    FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lab_results.user_id
DO $$ BEGIN
  ALTER TABLE public.lab_results ADD CONSTRAINT fk_lab_results_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- lab_results.ordered_by
DO $$ BEGIN
  ALTER TABLE public.lab_results ADD CONSTRAINT fk_lab_results_ordered_by
    FOREIGN KEY (ordered_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- prescriptions.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.prescriptions ADD CONSTRAINT fk_prescriptions_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- prescriptions.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.prescriptions ADD CONSTRAINT fk_prescriptions_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- appointments.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT fk_appointments_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- appointments.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT fk_appointments_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- video_rooms.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.video_rooms ADD CONSTRAINT fk_video_rooms_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- video_rooms.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.video_rooms ADD CONSTRAINT fk_video_rooms_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- video_room_participants.user_id
DO $$ BEGIN
  ALTER TABLE public.video_room_participants ADD CONSTRAINT fk_video_room_participants_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- video_call_notes.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.video_call_notes ADD CONSTRAINT fk_video_call_notes_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- video_call_notes.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.video_call_notes ADD CONSTRAINT fk_video_call_notes_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- refill_requests.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.refill_requests ADD CONSTRAINT fk_refill_requests_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- clinician_messages.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.clinician_messages ADD CONSTRAINT fk_clinician_messages_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- clinician_messages.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.clinician_messages ADD CONSTRAINT fk_clinician_messages_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- caregiver_messages.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.caregiver_messages ADD CONSTRAINT fk_caregiver_messages_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- caregiver_messages.caregiver_user_id
DO $$ BEGIN
  ALTER TABLE public.caregiver_messages ADD CONSTRAINT fk_caregiver_messages_caregiver_user_id
    FOREIGN KEY (caregiver_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_engagement_scores.user_id
DO $$ BEGIN
  ALTER TABLE public.patient_engagement_scores ADD CONSTRAINT fk_patient_engagement_scores_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- push_subscriptions.user_id
DO $$ BEGIN
  ALTER TABLE public.push_subscriptions ADD CONSTRAINT fk_push_subscriptions_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- notification_history.user_id
DO $$ BEGIN
  ALTER TABLE public.notification_history ADD CONSTRAINT fk_notification_history_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- trusted_devices.user_id
DO $$ BEGIN
  ALTER TABLE public.trusted_devices ADD CONSTRAINT fk_trusted_devices_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- security_events.user_id
DO $$ BEGIN
  ALTER TABLE public.security_events ADD CONSTRAINT fk_security_events_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- data_access_log.user_id
DO $$ BEGIN
  ALTER TABLE public.data_access_log ADD CONSTRAINT fk_data_access_log_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- data_access_log.patient_id
DO $$ BEGIN
  ALTER TABLE public.data_access_log ADD CONSTRAINT fk_data_access_log_patient_id
    FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_sessions.user_id
DO $$ BEGIN
  ALTER TABLE public.user_sessions ADD CONSTRAINT fk_user_sessions_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- user_login_locations.user_id
DO $$ BEGIN
  ALTER TABLE public.user_login_locations ADD CONSTRAINT fk_user_login_locations_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_chronic_conditions.user_id
DO $$ BEGIN
  ALTER TABLE public.patient_chronic_conditions ADD CONSTRAINT fk_patient_chronic_conditions_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_allergies.user_id
DO $$ BEGIN
  ALTER TABLE public.patient_allergies ADD CONSTRAINT fk_patient_allergies_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_emergency_contacts.user_id
DO $$ BEGIN
  ALTER TABLE public.patient_emergency_contacts ADD CONSTRAINT fk_patient_emergency_contacts_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- soap_notes.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.soap_notes ADD CONSTRAINT fk_soap_notes_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- soap_notes.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.soap_notes ADD CONSTRAINT fk_soap_notes_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- red_flag_alerts.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.red_flag_alerts ADD CONSTRAINT fk_red_flag_alerts_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- red_flag_alerts.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.red_flag_alerts ADD CONSTRAINT fk_red_flag_alerts_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- polypharmacy_warnings.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.polypharmacy_warnings ADD CONSTRAINT fk_polypharmacy_warnings_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_risk_flags.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.patient_risk_flags ADD CONSTRAINT fk_patient_risk_flags_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_risk_flags.clinician_user_id
DO $$ BEGIN
  ALTER TABLE public.patient_risk_flags ADD CONSTRAINT fk_patient_risk_flags_clinician_user_id
    FOREIGN KEY (clinician_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- patient_preferred_pharmacies.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.patient_preferred_pharmacies ADD CONSTRAINT fk_patient_preferred_pharmacies_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- medication_availability_alerts.patient_user_id
DO $$ BEGIN
  ALTER TABLE public.medication_availability_alerts ADD CONSTRAINT fk_medication_availability_alerts_patient_user_id
    FOREIGN KEY (patient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- email_ab_assignments.user_id
DO $$ BEGIN
  ALTER TABLE public.email_ab_assignments ADD CONSTRAINT fk_email_ab_assignments_user_id
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
