import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface LogMedicationParams {
  logId: string;
  status: "taken" | "skipped";
  takenAt?: string;
}

export function useOfflineMedicationLog() {
  const { isOnline } = useOfflineStatus();
  const { t } = useLanguage();

  const logMedication = useCallback(
    async ({ logId, status, takenAt }: LogMedicationParams): Promise<boolean> => {
      const updateData = {
        status,
        ...(status === "taken" && { taken_at: takenAt || new Date().toISOString() }),
      };

      if (isOnline) {
        // Online: Direct update
        try {
          const { error } = await supabase
            .from("medication_logs")
            .update(updateData)
            .eq("id", logId);

          if (error) throw error;
          return true;
        } catch (error) {
          console.error("[useOfflineMedicationLog] Online update failed:", error);
          toast.error(t.offline.updateFailed);
          return false;
        }
      } else {
        // Offline: Queue the action
        try {
          const session = await supabase.auth.getSession();
          const accessToken = session.data.session?.access_token;

          if (!accessToken) {
            toast.error(t.offline.notAuthenticated);
            return false;
          }

          await offlineQueue.addAction({
            type: "medication_log",
            url: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/medication_logs?id=eq.${logId}`,
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
              Prefer: "return=minimal",
            },
            body: updateData,
          });

          toast.info(t.offline.queuedForSync);
          return true;
        } catch (error) {
          console.error("[useOfflineMedicationLog] Queue failed:", error);
          toast.error(t.offline.queueFailed);
          return false;
        }
      }
    },
    [isOnline, t]
  );

  return {
    logMedication,
    isOnline,
  };
}
