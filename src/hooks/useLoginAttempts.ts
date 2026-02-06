import { useCallback } from "react";
import { db } from "@/integrations/db";

interface LockoutStatus {
  locked: boolean;
  locked_until?: string;
  failed_attempts?: number;
  minutes_remaining?: number;
}

interface LoginAttemptResult {
  locked: boolean;
  locked_until?: string;
  failed_attempts?: number;
  remaining_attempts?: number;
  message: string;
}

export function useLoginAttempts() {
  const checkAccountLocked = useCallback(async (email: string): Promise<LockoutStatus> => {
    try {
      const { data, error } = await db.rpc("check_account_locked", {
        p_email: email,
      });

      if (error) {
        console.error("Error checking account lock status:", error);
        return { locked: false };
      }

      return data as unknown as LockoutStatus;
    } catch (error) {
      console.error("Error checking account lock status:", error);
      return { locked: false };
    }
  }, []);

  const recordLoginAttempt = useCallback(
    async (
      email: string,
      success: boolean,
      ipAddress?: string
    ): Promise<LoginAttemptResult> => {
      try {
        const userAgent = navigator.userAgent;

        const { data, error } = await db.rpc("record_login_attempt", {
          p_email: email,
          p_success: success,
          p_ip_address: ipAddress || null,
          p_user_agent: userAgent,
        });

        if (error) {
          console.error("Error recording login attempt:", error);
          return { locked: false, message: "Error recording attempt" };
        }

        return data as unknown as LoginAttemptResult;
      } catch (error) {
        console.error("Error recording login attempt:", error);
        return { locked: false, message: "Error recording attempt" };
      }
    },
    []
  );

  const formatLockoutMessage = useCallback((lockoutStatus: LockoutStatus): string => {
    if (!lockoutStatus.locked) return "";

    const minutesRemaining = Math.ceil(lockoutStatus.minutes_remaining || 0);
    if (minutesRemaining <= 1) {
      return "Your account is temporarily locked. Please try again in about a minute.";
    }
    return `Your account is temporarily locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`;
  }, []);

  return {
    checkAccountLocked,
    recordLoginAttempt,
    formatLockoutMessage,
  };
}
