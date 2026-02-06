-- ============================================================
-- Drop tables no longer referenced by any frontend screen
-- ============================================================

-- MFA managed externally by Azure AD B2C
DROP TABLE IF EXISTS public.mfa_recovery_codes;

-- No frontend reference; video_room_participants.is_in_waiting_room used instead
DROP TABLE IF EXISTS public.waiting_room_queue;

-- No frontend reference; no alert UI for abnormal vitals
DROP TABLE IF EXISTS public.vitals_alerts;

-- No frontend reference; video_call_notes used instead
DROP TABLE IF EXISTS public.post_call_summaries;
