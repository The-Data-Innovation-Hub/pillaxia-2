import { useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

type ActivityType = 
  | "login" 
  | "page_view" 
  | "medication_logged" 
  | "symptom_logged" 
  | "profile_updated"
  | "notification_opened"
  | "angela_chat";

export function useActivityTracking() {
  const { user } = useAuth();
  const location = useLocation();

  const trackActivity = useCallback(
    async (activityType: ActivityType, activityData: Record<string, unknown> = {}) => {
      if (!user) return;

      try {
        await supabase.from("patient_activity_log").insert({
          user_id: user.id,
          activity_type: activityType,
          activity_data: {
            ...activityData,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        // Silent fail - don't disrupt user experience for tracking
        console.error("Activity tracking error:", error);
      }
    },
    [user]
  );

  // Track page views automatically
  useEffect(() => {
    if (user && location.pathname.startsWith("/dashboard")) {
      trackActivity("page_view", { path: location.pathname });
    }
  }, [location.pathname, user, trackActivity]);

  return { trackActivity };
}
