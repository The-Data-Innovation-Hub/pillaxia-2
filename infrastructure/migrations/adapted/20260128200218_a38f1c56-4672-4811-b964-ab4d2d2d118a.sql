-- Advanced Database Optimization: Strategic Indexes for Performance
-- This migration adds indexes on frequently queried columns to optimize query performance

-- =====================================================
-- MEDICATIONS & SCHEDULES (High-frequency patient queries)
-- =====================================================

-- Medications: user lookups with active filter
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_user_active 
ON public.medications (user_id, is_active);

-- Medications: prescription status filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medications_prescription_status 
ON public.medications (prescription_status) WHERE is_active = true;

-- Medication schedules: user + active filter for daily schedule queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_schedules_user_active 
ON public.medication_schedules (user_id, is_active);

-- Medication schedules: medication lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_schedules_medication 
ON public.medication_schedules (medication_id);

-- Medication logs: user + scheduled time for dashboard queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_logs_user_scheduled 
ON public.medication_logs (user_id, scheduled_time DESC);

-- Medication logs: status filtering for adherence calculations
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_logs_user_status 
ON public.medication_logs (user_id, status);

-- =====================================================
-- APPOINTMENTS (Clinician & Patient dashboards)
-- =====================================================

-- Appointments: patient lookup with date
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_patient_date 
ON public.appointments (patient_user_id, appointment_date DESC);

-- Appointments: clinician lookup with date
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_clinician_date 
ON public.appointments (clinician_user_id, appointment_date DESC);

-- Appointments: status filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_appointments_status 
ON public.appointments (status) WHERE status IN ('scheduled', 'confirmed');

-- =====================================================
-- PRESCRIPTIONS (E-Prescribing workflows)
-- =====================================================

-- Prescriptions: patient lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_patient 
ON public.prescriptions (patient_user_id, created_at DESC);

-- Prescriptions: clinician lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_clinician 
ON public.prescriptions (clinician_user_id, created_at DESC);

-- Prescriptions: status filtering for pending actions
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_prescriptions_status 
ON public.prescriptions (status) WHERE status IN ('pending', 'sent');

-- =====================================================
-- NOTIFICATIONS (High-volume delivery tracking)
-- =====================================================

-- Notification history: user lookup with recency
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notification_history_user_created 
ON public.notification_history (user_id, created_at DESC);

-- Notification history: retry queue processing
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notification_history_retry_queue 
ON public.notification_history (next_retry_at) 
WHERE status = 'failed' AND retry_count < max_retries;

-- Notification history: channel + type analytics
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_notification_history_channel_type 
ON public.notification_history (channel, notification_type);

-- =====================================================
-- AUDIT & SECURITY (Compliance queries)
-- =====================================================

-- Audit log: time-based queries for compliance reports
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_log_created 
ON public.audit_log (created_at DESC);

-- Audit log: user activity tracking
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_log_user_created 
ON public.audit_log (user_id, created_at DESC);

-- Audit log: action type filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_audit_log_action 
ON public.audit_log (action);

-- Security events: user lookup with recency
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_security_events_user_created 
ON public.security_events (user_id, created_at DESC);

-- Security events: event type filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_security_events_type 
ON public.security_events (event_type);

-- Security events: severity for alerting
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_security_events_severity 
ON public.security_events (severity) WHERE severity IN ('high', 'critical');

-- Data access log: compliance auditing
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_data_access_log_user_created 
ON public.data_access_log (user_id, created_at DESC);

-- Data access log: patient data access tracking
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_data_access_log_patient 
ON public.data_access_log (patient_id, created_at DESC) WHERE patient_id IS NOT NULL;

-- Login attempts: security monitoring
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_login_attempts_email_created 
ON public.login_attempts (email, created_at DESC);

-- Account lockouts: active lockout checks
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_account_lockouts_email_active 
ON public.account_lockouts (email) WHERE unlocked_at IS NULL;

-- =====================================================
-- SYMPTOMS & HEALTH DATA (Patient tracking)
-- =====================================================

-- Symptom entries: user lookup with recency
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_symptom_entries_user_recorded 
ON public.symptom_entries (user_id, recorded_at DESC);

-- Symptom entries: type filtering for correlations
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_symptom_entries_type 
ON public.symptom_entries (symptom_type);

-- Lab results: user lookup with ordering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_lab_results_user_ordered 
ON public.lab_results (user_id, ordered_at DESC);

-- =====================================================
-- ORGANIZATIONS & MULTI-TENANCY
-- =====================================================

-- Organization members: user membership lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_members_user_active 
ON public.organization_members (user_id, is_active);

-- Organization members: org roster
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_members_org_active 
ON public.organization_members (organization_id, is_active);

-- Organization subscriptions: active subscription lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_org_subscriptions_org_status 
ON public.organization_subscriptions (organization_id, status);

-- =====================================================
-- CLINICAL RELATIONSHIPS
-- =====================================================

-- Clinician-patient assignments: bidirectional lookups
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_clinician_patient_clinician 
ON public.clinician_patient_assignments (clinician_user_id);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_clinician_patient_patient 
ON public.clinician_patient_assignments (patient_user_id);

-- Clinician messages: conversation lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_clinician_messages_patient_created 
ON public.clinician_messages (patient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_clinician_messages_clinician_created 
ON public.clinician_messages (clinician_user_id, created_at DESC);

-- Caregiver invitations: status filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_caregiver_invitations_patient_status 
ON public.caregiver_invitations (patient_user_id, status);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_caregiver_invitations_caregiver 
ON public.caregiver_invitations (caregiver_user_id) WHERE status = 'accepted';

-- =====================================================
-- PHARMACY & INVENTORY
-- =====================================================

-- Refill requests: status queue
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_refill_requests_status 
ON public.refill_requests (status) WHERE status IN ('pending', 'approved');

-- Controlled drugs: low stock alerts
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_controlled_drugs_stock_alert 
ON public.controlled_drugs (current_stock, minimum_stock) WHERE is_active = true;

-- Drug recalls: active recalls
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_drug_recalls_active 
ON public.drug_recalls (is_active, recall_date DESC) WHERE is_active = true;

-- =====================================================
-- POLYPHARMACY MONITORING
-- =====================================================

-- Polypharmacy warnings: unacknowledged alerts
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_polypharmacy_warnings_unacked 
ON public.polypharmacy_warnings (patient_user_id) WHERE is_acknowledged = false;

-- =====================================================
-- SESSIONS & DEVICES
-- =====================================================

-- User sessions: active session lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_sessions_user_active 
ON public.user_sessions (user_id, is_active) WHERE is_active = true;

-- Trusted devices: active device lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_trusted_devices_user_active 
ON public.trusted_devices (user_id, is_active) WHERE is_active = true;

-- Push subscriptions: user lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_push_subscriptions_user 
ON public.push_subscriptions (user_id);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON JOIN PATTERNS
-- =====================================================

-- Medication logs with schedule join optimization
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_medication_logs_schedule_med 
ON public.medication_logs (schedule_id, medication_id);

-- Video rooms: appointment lookup
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_video_rooms_created 
ON public.video_rooms (created_at DESC) WHERE status = 'active';

-- Profiles: organization filtering
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_profiles_organization 
ON public.profiles (organization_id) WHERE organization_id IS NOT NULL;

-- User roles: role-based queries
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_user_roles_role 
ON public.user_roles (role);