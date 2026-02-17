-- Phase 1: Add Missing Constraints
-- This migration adds foreign keys, indexes, unique constraints, and NOT NULL constraints
-- to improve data integrity without changing table structures.

-- ============================================================
-- PART 1: Add Missing Foreign Key Constraints
-- ============================================================

-- medication_logs.medication_id → medications(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medication_logs_medication_id_fkey'
  ) THEN
    ALTER TABLE public.medication_logs
      ADD CONSTRAINT medication_logs_medication_id_fkey
      FOREIGN KEY (medication_id)
      REFERENCES public.medications(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- refill_requests.medication_id → medications(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refill_requests_medication_id_fkey'
  ) THEN
    ALTER TABLE public.refill_requests
      ADD CONSTRAINT refill_requests_medication_id_fkey
      FOREIGN KEY (medication_id)
      REFERENCES public.medications(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- red_flag_alerts.symptom_entry_id → symptom_entries(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'red_flag_alerts_symptom_entry_id_fkey'
  ) THEN
    ALTER TABLE public.red_flag_alerts
      ADD CONSTRAINT red_flag_alerts_symptom_entry_id_fkey
      FOREIGN KEY (symptom_entry_id)
      REFERENCES public.symptom_entries(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- vitals_alerts.vital_id → patient_vitals(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vitals_alerts_vital_id_fkey'
  ) THEN
    ALTER TABLE public.vitals_alerts
      ADD CONSTRAINT vitals_alerts_vital_id_fkey
      FOREIGN KEY (vital_id)
      REFERENCES public.patient_vitals(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- video_room_participants.room_id → video_rooms(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'video_room_participants_room_id_fkey'
  ) THEN
    ALTER TABLE public.video_room_participants
      ADD CONSTRAINT video_room_participants_room_id_fkey
      FOREIGN KEY (room_id)
      REFERENCES public.video_rooms(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- video_room_participants.admitted_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'video_room_participants_admitted_by_fkey'
  ) THEN
    ALTER TABLE public.video_room_participants
      ADD CONSTRAINT video_room_participants_admitted_by_fkey
      FOREIGN KEY (admitted_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- waiting_room_queue.room_id → video_rooms(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'waiting_room_queue_room_id_fkey'
  ) THEN
    ALTER TABLE public.waiting_room_queue
      ADD CONSTRAINT waiting_room_queue_room_id_fkey
      FOREIGN KEY (room_id)
      REFERENCES public.video_rooms(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- drug_transfers.approved_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_transfers_approved_by_fkey'
  ) THEN
    ALTER TABLE public.drug_transfers
      ADD CONSTRAINT drug_transfers_approved_by_fkey
      FOREIGN KEY (approved_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- drug_transfers.completed_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_transfers_completed_by_fkey'
  ) THEN
    ALTER TABLE public.drug_transfers
      ADD CONSTRAINT drug_transfers_completed_by_fkey
      FOREIGN KEY (completed_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- compliance_reports.generated_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'compliance_reports_generated_by_fkey'
  ) THEN
    ALTER TABLE public.compliance_reports
      ADD CONSTRAINT compliance_reports_generated_by_fkey
      FOREIGN KEY (generated_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- drug_recalls.created_by → users(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_recalls_created_by_fkey'
  ) THEN
    ALTER TABLE public.drug_recalls
      ADD CONSTRAINT drug_recalls_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- video_rooms.appointment_id → appointments(id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'video_rooms_appointment_id_fkey'
  ) THEN
    ALTER TABLE public.video_rooms
      ADD CONSTRAINT video_rooms_appointment_id_fkey
      FOREIGN KEY (appointment_id)
      REFERENCES public.appointments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- PART 2: Add Missing Indexes on Foreign Keys
-- ============================================================

-- Index on medications.medication_catalog_id
CREATE INDEX IF NOT EXISTS idx_medications_medication_catalog_id
  ON public.medications(medication_catalog_id);

-- Index on prescriptions.pharmacy_id
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy_id
  ON public.prescriptions(pharmacy_id);

-- Index on medication_logs.medication_id
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id
  ON public.medication_logs(medication_id);

-- Index on refill_requests.medication_id
CREATE INDEX IF NOT EXISTS idx_refill_requests_medication_id
  ON public.refill_requests(medication_id);

-- Index on video_room_participants.room_id
CREATE INDEX IF NOT EXISTS idx_video_room_participants_room_id
  ON public.video_room_participants(room_id);

-- Index on video_room_participants.admitted_by
CREATE INDEX IF NOT EXISTS idx_video_room_participants_admitted_by
  ON public.video_room_participants(admitted_by);

-- Index on waiting_room_queue.room_id
CREATE INDEX IF NOT EXISTS idx_waiting_room_queue_room_id
  ON public.waiting_room_queue(room_id);

-- Index on appointments.video_room_id
CREATE INDEX IF NOT EXISTS idx_appointments_video_room_id
  ON public.appointments(video_room_id);

-- Index on vitals_alerts.vital_id
CREATE INDEX IF NOT EXISTS idx_vitals_alerts_vital_id
  ON public.vitals_alerts(vital_id);

-- Composite index for common medication queries
CREATE INDEX IF NOT EXISTS idx_medications_user_status_date
  ON public.medications(user_id, prescription_status, start_date DESC)
  WHERE is_active = true;

-- ============================================================
-- PART 3: Add Missing Unique Constraints
-- ============================================================

-- profiles.user_id should be unique (one profile per user)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    -- First, clean up any duplicates (keep oldest by created_at)
    DELETE FROM public.profiles p1
    WHERE EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p1.user_id = p2.user_id
        AND p1.created_at > p2.created_at
    );

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- external_user_mapping.user_id should be unique
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'external_user_mapping_user_id_key'
  ) THEN
    -- Clean up duplicates (keep first by creation)
    DELETE FROM public.external_user_mapping e1
    WHERE EXISTS (
      SELECT 1 FROM public.external_user_mapping e2
      WHERE e1.user_id = e2.user_id
        AND e1.created_at > e2.created_at
    );

    ALTER TABLE public.external_user_mapping
      ADD CONSTRAINT external_user_mapping_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- organization_members: prevent duplicate membership
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_members_org_user_key'
  ) THEN
    -- Clean up duplicates (keep oldest)
    DELETE FROM public.organization_members om1
    WHERE EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om1.organization_id = om2.organization_id
        AND om1.user_id = om2.user_id
        AND om1.joined_at > om2.joined_at
    );

    ALTER TABLE public.organization_members
      ADD CONSTRAINT org_members_org_user_key
      UNIQUE (organization_id, user_id);
  END IF;
END $$;

-- patient_preferred_pharmacies: prevent duplicate preferences
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_pref_pharmacy_key'
  ) THEN
    -- Clean up duplicates (keep oldest)
    DELETE FROM public.patient_preferred_pharmacies pp1
    WHERE EXISTS (
      SELECT 1 FROM public.patient_preferred_pharmacies pp2
      WHERE pp1.patient_user_id = pp2.patient_user_id
        AND pp1.pharmacy_id = pp2.pharmacy_id
        AND pp1.created_at > pp2.created_at
    );

    ALTER TABLE public.patient_preferred_pharmacies
      ADD CONSTRAINT patient_pref_pharmacy_key
      UNIQUE (patient_user_id, pharmacy_id);
  END IF;
END $$;

-- push_subscriptions: prevent duplicate subscriptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subs_user_endpoint_key'
  ) THEN
    -- Clean up duplicates (keep newest for subscriptions)
    DELETE FROM public.push_subscriptions ps1
    WHERE EXISTS (
      SELECT 1 FROM public.push_subscriptions ps2
      WHERE ps1.user_id = ps2.user_id
        AND ps1.endpoint = ps2.endpoint
        AND ps1.created_at < ps2.created_at
    );

    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subs_user_endpoint_key
      UNIQUE (user_id, endpoint);
  END IF;
END $$;

-- user_roles: one role per user (prevent duplicates)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    -- Clean up duplicates (keep oldest)
    DELETE FROM public.user_roles ur1
    WHERE EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur1.user_id = ur2.user_id
        AND ur1.role = ur2.role
        AND ur1.created_at > ur2.created_at
    );

    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key
      UNIQUE (user_id, role);
  END IF;
END $$;

-- ============================================================
-- PART 4: Add Check Constraints for Data Validity
-- ============================================================

-- medications: start_date must be <= end_date
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medications_valid_date_range'
  ) THEN
    ALTER TABLE public.medications
      ADD CONSTRAINT medications_valid_date_range
      CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);
  END IF;
END $$;

-- medications: refills_remaining <= refills_authorized
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'medications_valid_refills'
  ) THEN
    ALTER TABLE public.medications
      ADD CONSTRAINT medications_valid_refills
      CHECK (refills_remaining <= refills_authorized);
  END IF;
END $$;

-- patient_vitals: recorded_at should not be in future
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_vitals_recorded_time_valid'
  ) THEN
    ALTER TABLE public.patient_vitals
      ADD CONSTRAINT patient_vitals_recorded_time_valid
      CHECK (recorded_at <= NOW());
  END IF;
END $$;

-- red_flag_alerts: if acknowledged, must have acknowledger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'red_flag_alerts_acknowledger_required'
  ) THEN
    ALTER TABLE public.red_flag_alerts
      ADD CONSTRAINT red_flag_alerts_acknowledger_required
      CHECK ((NOT is_acknowledged) OR (acknowledged_by IS NOT NULL));
  END IF;
END $$;

-- patient_risk_flags: if resolved, must have resolver
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patient_risk_flags_resolver_required'
  ) THEN
    ALTER TABLE public.patient_risk_flags
      ADD CONSTRAINT patient_risk_flags_resolver_required
      CHECK ((NOT is_resolved) OR (resolved_by IS NOT NULL));
  END IF;
END $$;

-- controlled_drug_dispensing: quantity_remaining must be valid
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'controlled_drug_dispensing_valid_quantity'
  ) THEN
    ALTER TABLE public.controlled_drug_dispensing
      ADD CONSTRAINT controlled_drug_dispensing_valid_quantity
      CHECK (quantity_remaining >= 0);
  END IF;
END $$;

-- ============================================================
-- Success Message
-- ============================================================

SELECT 'Phase 1 migration completed: Added missing constraints, indexes, and data integrity rules' AS status;
