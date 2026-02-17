-- =====================================================
-- Phase 4: Database Improvements - Indexes & Optimization
-- =====================================================

-- 1. Composite indexes for high-frequency queries
-- =====================================================

-- Medication logs: optimize dashboard queries for recent logs
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_status_time 
ON public.medication_logs (user_id, status, scheduled_time DESC);

-- Medication schedules: optimize active schedule lookups
CREATE INDEX IF NOT EXISTS idx_medication_schedules_user_active 
ON public.medication_schedules (user_id, is_active) 
WHERE is_active = true;

-- Appointments: optimize upcoming appointments queries
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date 
ON public.appointments (patient_user_id, appointment_date, appointment_time);

CREATE INDEX IF NOT EXISTS idx_appointments_clinician_date 
ON public.appointments (clinician_user_id, appointment_date, appointment_time);

-- Prescriptions: optimize status and patient queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_status 
ON public.prescriptions (patient_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_clinician_status 
ON public.prescriptions (clinician_user_id, status, created_at DESC);

-- Notification history: optimize user notification queries
CREATE INDEX IF NOT EXISTS idx_notification_history_user_created 
ON public.notification_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_status_retry 
ON public.notification_history (status, next_retry_at) 
WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- 2. GIN indexes for JSONB columns
-- =====================================================

-- Patient engagement scores metrics
CREATE INDEX IF NOT EXISTS idx_engagement_scores_metrics 
ON public.patient_engagement_scores USING GIN (metrics);

-- Notification history metadata
CREATE INDEX IF NOT EXISTS idx_notification_history_metadata 
ON public.notification_history USING GIN (metadata);

-- Security events metadata for compliance queries
CREATE INDEX IF NOT EXISTS idx_security_events_metadata 
ON public.security_events USING GIN (metadata);

-- Audit log details for forensic queries
CREATE INDEX IF NOT EXISTS idx_audit_log_details 
ON public.audit_log USING GIN (details);

-- 3. Partial indexes for common filter patterns
-- =====================================================

-- Active medications only
CREATE INDEX IF NOT EXISTS idx_medications_user_active 
ON public.medications (user_id, name) 
WHERE is_active = true;

-- Pending prescriptions for pharmacist dashboard
CREATE INDEX IF NOT EXISTS idx_prescriptions_pending 
ON public.prescriptions (pharmacy_id, created_at DESC) 
WHERE status = 'pending';

-- Unread clinician messages
CREATE INDEX IF NOT EXISTS idx_clinician_messages_unread 
ON public.clinician_messages (patient_user_id, created_at DESC) 
WHERE is_read = false;

-- Active controlled drugs with low stock
CREATE INDEX IF NOT EXISTS idx_controlled_drugs_low_stock 
ON public.controlled_drugs (current_stock, minimum_stock) 
WHERE is_active = true AND current_stock <= minimum_stock;

-- 4. Organization multi-tenancy indexes
-- =====================================================

-- Organization members lookup
CREATE INDEX IF NOT EXISTS idx_org_members_org_active 
ON public.organization_members (organization_id, is_active) 
WHERE is_active = true;

-- Organization subscriptions status
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status 
ON public.organization_subscriptions (organization_id, status);

-- 5. Security and compliance indexes
-- =====================================================

-- Login attempts for rate limiting
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time 
ON public.login_attempts (email, created_at DESC);

-- Account lockouts active check
CREATE INDEX IF NOT EXISTS idx_account_lockouts_active 
ON public.account_lockouts (email, locked_until) 
WHERE unlocked_at IS NULL;

-- Data access log for compliance audits
CREATE INDEX IF NOT EXISTS idx_data_access_log_user_time 
ON public.data_access_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_access_log_patient_time 
ON public.data_access_log (patient_id, created_at DESC) 
WHERE patient_id IS NOT NULL;

-- Security events by type and severity
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity 
ON public.security_events (event_type, severity, created_at DESC);

-- 6. Caregiver relationship indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_patient 
ON public.caregiver_invitations (patient_user_id, status);

CREATE INDEX IF NOT EXISTS idx_caregiver_invitations_caregiver 
ON public.caregiver_invitations (caregiver_user_id, status) 
WHERE caregiver_user_id IS NOT NULL;

-- 7. Pharmacy and drug management indexes
-- =====================================================

-- Drug recalls active lookup
CREATE INDEX IF NOT EXISTS idx_drug_recalls_active 
ON public.drug_recalls (recall_date DESC) 
WHERE is_active = true;

-- Medication availability by pharmacy
CREATE INDEX IF NOT EXISTS idx_medication_availability_pharmacy 
ON public.medication_availability (pharmacy_id, medication_name) 
WHERE is_available = true;

-- Drug transfers by status
CREATE INDEX IF NOT EXISTS idx_drug_transfers_status 
ON public.drug_transfers (status, requested_at DESC);

-- 8. Lab results indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_lab_results_user_category 
ON public.lab_results (user_id, category, ordered_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_results_abnormal 
ON public.lab_results (user_id, resulted_at DESC) 
WHERE is_abnormal = true;

-- 9. Video rooms and telemedicine
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_video_rooms_status 
ON public.video_rooms (status, created_at DESC) 
WHERE status = 'active';

-- 10. Billing and payment indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_org_invoices_status 
ON public.organization_invoices (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_org_type 
ON public.billing_events (organization_id, event_type, created_at DESC);