import { useEffect, useCallback, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listSecuritySettings } from "@/integrations/azure/data";
import { toast } from "sonner";

interface SessionSettings {
  timeoutMinutes: number;
  maxConcurrentSessions: number;
}

const DEFAULT_SETTINGS: SessionSettings = {
  timeoutMinutes: 30,
  maxConcurrentSessions: 3,
};

export function useSessionManager() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch security settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await listSecuritySettings([
          "session_timeout_minutes",
          "max_concurrent_sessions",
        ]);
        if (data?.length) {
          const newSettings = { ...DEFAULT_SETTINGS };
          data.forEach((setting) => {
            const settingValue = setting.setting_value as Record<string, unknown> | null;
            if (setting.setting_key === "session_timeout_minutes" && settingValue) {
              newSettings.timeoutMinutes = (settingValue.value as number) ?? 30;
            } else if (setting.setting_key === "max_concurrent_sessions" && settingValue) {
              newSettings.maxConcurrentSessions = (settingValue.value as number) ?? 3;
            }
          });
          setSettings(newSettings);
        }
      } catch (error) {
        console.error("Failed to fetch session settings:", error);
      }
    };

    if (user) {
      fetchSettings();
    }
  }, [user]);

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setRemainingTime(null);

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!user) return;

    const timeoutMs = settings.timeoutMinutes * 60 * 1000;
    const warningMs = timeoutMs - 2 * 60 * 1000; // 2 minutes before timeout

    // Set warning timer (2 minutes before timeout)
    warningRef.current = setTimeout(() => {
      toast.warning("Session expiring soon", {
        description: "You will be logged out in 2 minutes due to inactivity.",
        duration: 10000,
      });

      // Start countdown
      let remaining = 120; // 2 minutes in seconds
      setRemainingTime(remaining);

      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setRemainingTime(remaining);

        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      }, 1000);
    }, warningMs);

    // Set timeout timer
    timeoutRef.current = setTimeout(async () => {
      // Log the timeout event
      try {
        const { logSecurityEvent } = await import("@/integrations/azure/data");
        await logSecurityEvent({
          user_id: user.id,
          event_type: "session_timeout",
          event_category: "authentication",
          severity: "info",
          description: "User session timed out due to inactivity",
          ip_address: null,
          metadata: { timeout_minutes: settings.timeoutMinutes },
        });
      } catch {
        // Ignore logging errors
      }

      toast.error("Session expired", {
        description: "You have been logged out due to inactivity.",
      });

      await signOut();
    }, timeoutMs);
  }, [user, settings, signOut]);

  // Activity event listeners
  useEffect(() => {
    if (!user) return;

    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];

    const handleActivity = () => {
      // Debounce: only reset if last activity was more than 30 seconds ago
      if (Date.now() - lastActivityRef.current > 30000) {
        resetActivityTimer();
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer setup
    resetActivityTimer();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user, resetActivityTimer]);

  // Extend session manually
  const extendSession = useCallback(() => {
    resetActivityTimer();
    toast.success("Session extended", {
      description: `Your session has been extended for another ${settings.timeoutMinutes} minutes.`,
    });
  }, [resetActivityTimer, settings.timeoutMinutes]);

  return {
    remainingTime,
    settings,
    extendSession,
    resetActivityTimer,
  };
}
