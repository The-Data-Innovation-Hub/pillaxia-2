import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  logSecurityEvent as apiLogSecurityEvent,
  logDataAccess as apiLogDataAccess,
  sendSecurityAlert,
} from "@/integrations/azure/data";

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

const SEVERITY_BASED_EVENTS: SecurityEventType[] = ["login_failure"];

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
      await sendSecurityAlert({
        userId,
        eventType,
        severity,
        description,
        metadata,
      });
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
        await apiLogSecurityEvent({
          user_id: user?.id ?? null,
          event_type: eventType,
          event_category: category,
          severity,
          description: description ?? null,
          ip_address: null,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          },
        });

        if (user?.id) {
          const shouldNotify =
            CRITICAL_EVENTS.includes(eventType) ||
            (SEVERITY_BASED_EVENTS.includes(eventType) && severity === "critical");

          if (shouldNotify) {
            sendSecurityAlertEmail(
              user.id,
              eventType,
              severity,
              description,
              { ...metadata, url: typeof window !== "undefined" ? window.location.href : undefined }
            );
          }
        }
      } catch (error) {
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
        await apiLogDataAccess({
          user_id: user.id,
          accessed_table: accessedTable,
          accessed_record_id: accessedRecordId ?? null,
          access_type: accessType,
          data_category: dataCategory,
          patient_id: patientId ?? null,
          reason: reason ?? null,
        });
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
