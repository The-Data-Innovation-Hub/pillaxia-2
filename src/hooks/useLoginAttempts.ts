import { useCallback } from "react";
import { checkAccountLocked as apiCheckAccountLocked, recordLoginAttempt as apiRecordLoginAttempt } from "@/integrations/azure/data";

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
    const data = await apiCheckAccountLocked(email);
    return data as LockoutStatus;
  }, []);

  const recordLoginAttempt = useCallback(
    async (
      email: string,
      success: boolean,
      ipAddress?: string
    ): Promise<LoginAttemptResult> => {
      const data = await apiRecordLoginAttempt(email, success, {
        ipAddress,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      return {
        locked: data?.locked ?? false,
        locked_until: data?.locked_until,
        failed_attempts: data?.failed_attempts,
        remaining_attempts: data?.remaining_attempts,
        message: (data as { message?: string })?.message ?? "",
      } as LoginAttemptResult;
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
