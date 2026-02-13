/**
 * App enums used by admin/security pages.
 * Replaces dependency on Supabase Database types for enum values.
 */

export type AppRole =
  | "patient"
  | "clinician"
  | "pharmacist"
  | "admin"
  | "caregiver";

export type SecurityEventType =
  | "login_success"
  | "login_failure"
  | "logout"
  | "password_change"
  | "password_reset_request"
  | "mfa_enabled"
  | "mfa_disabled"
  | "session_timeout"
  | "concurrent_session_blocked"
  | "suspicious_activity"
  | "data_export"
  | "data_access"
  | "permission_change"
  | "account_locked"
  | "account_unlocked";

export type Json = unknown;
