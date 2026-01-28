import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SecurityEventType =
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

type SecurityEventCategory = "authentication" | "authorization" | "data_access" | "system" | "compliance";
type SecuritySeverity = "info" | "warning" | "critical";

interface LogSecurityEventParams {
  eventType: SecurityEventType;
  category?: SecurityEventCategory;
  severity?: SecuritySeverity;
  description?: string;
  metadata?: Record<string, unknown>;
}

interface LogDataAccessParams {
  accessedTable: string;
  accessedRecordId?: string;
  accessType: "view" | "create" | "update" | "delete" | "export" | "print";
  dataCategory?: "general" | "pii" | "phi" | "financial" | "credentials";
  patientId?: string;
  reason?: string;
}

// Events that should trigger email notifications
const CRITICAL_EVENTS: SecurityEventType[] = [
  "account_locked",
  "account_unlocked",
  "suspicious_activity",
  "concurrent_session_blocked",
  "password_change",
  "password_reset_request",
  "mfa_enabled",
  "mfa_disabled",
  "data_export",
  "permission_change",
];

// Events that should only notify on critical severity
const SEVERITY_BASED_EVENTS: SecurityEventType[] = [
  "login_failure",
];

export function useSecurityEvents() {
  const { user } = useAuth();

  const sendSecurityAlertEmail = useCallback(
    async (
      userId: string,
      eventType: SecurityEventType,
      severity: SecuritySeverity,
      description?: string,
      metadata?: Record<string, unknown>
    ) => {
      try {
        const { error } = await supabase.functions.invoke("send-security-alert", {
          body: {
            userId,
            eventType,
            severity,
            description,
            metadata,
          },
        });

        if (error) {
          console.error("Failed to send security alert email:", error);
        }
      } catch (error) {
        console.error("Error sending security alert email:", error);
      }
    },
    []
  );

  const logSecurityEvent = useCallback(
    async ({
      eventType,
      category = "authentication",
      severity = "info",
      description,
      metadata = {},
    }: LogSecurityEventParams) => {
      try {
        // Get client info
        const userAgent = navigator.userAgent;
        
        const { error } = await supabase.rpc("log_security_event", {
          p_user_id: user?.id || null,
          p_event_type: eventType,
          p_event_category: category,
          p_severity: severity,
          p_description: description || null,
          p_ip_address: null, // IP is captured server-side
          p_user_agent: userAgent,
          p_metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
            url: window.location.href,
          },
        });

        if (error) {
          console.error("Failed to log security event:", error);
        }

        // Send email notification for critical events
        if (user?.id) {
          const shouldNotify =
            CRITICAL_EVENTS.includes(eventType) ||
            (SEVERITY_BASED_EVENTS.includes(eventType) && severity === "critical");

          if (shouldNotify) {
            // Send email in background - don't await to avoid blocking
            sendSecurityAlertEmail(
              user.id,
              eventType,
              severity,
              description,
              {
                ...metadata,
                user_agent: userAgent,
                url: window.location.href,
              }
            );
          }
        }
      } catch (error) {
        // Silent fail - don't disrupt user experience
        console.error("Security event logging error:", error);
      }
    },
    [user, sendSecurityAlertEmail]
  );

  const logDataAccess = useCallback(
    async ({
      accessedTable,
      accessedRecordId,
      accessType,
      dataCategory = "general",
      patientId,
      reason,
    }: LogDataAccessParams) => {
      if (!user) return;

      try {
        const { error } = await supabase.rpc("log_data_access", {
          p_user_id: user.id,
          p_accessed_table: accessedTable,
          p_accessed_record_id: accessedRecordId || null,
          p_access_type: accessType,
          p_data_category: dataCategory,
          p_patient_id: patientId || null,
          p_reason: reason || null,
        });

        if (error) {
          console.error("Failed to log data access:", error);
        }
      } catch (error) {
        console.error("Data access logging error:", error);
      }
    },
    [user]
  );

  return {
    logSecurityEvent,
    logDataAccess,
    sendSecurityAlertEmail,
  };
}
