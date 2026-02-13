import { useCallback } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/integrations/azure/client";
import { updateMedicationLog } from "@/integrations/azure/data";

interface LogMedicationParams {
  logId: string;
  status: "taken" | "skipped";
  takenAt?: string;
}

export function useOfflineMedicationLog() {
  const { isOnline } = useOfflineStatus();
  const { t } = useLanguage();
  const { session } = useAuth();

  const logMedication = useCallback(
    async ({ logId, status, takenAt }: LogMedicationParams): Promise<boolean> => {
      const updateData = {
        status,
        ...(status === "taken" && { taken_at: takenAt || new Date().toISOString() }),
      };

      if (isOnline) {
        try {
          await updateMedicationLog(logId, updateData);
          return true;
        } catch (error) {
          console.error("[useOfflineMedicationLog] Online update failed:", error);
          toast.error(t.offline.updateFailed);
          return false;
        }
      } else {
        try {
          const accessToken = session?.access_token;
          if (!accessToken) {
            toast.error(t.offline.notAuthenticated);
            return false;
          }
          const base = getApiBaseUrl();
          if (!base) {
            toast.error(t.offline.updateFailed);
            return false;
          }
          await offlineQueue.addAction({
            type: "medication_log",
            url: `${base}/api/medication-logs/${logId}`,
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
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
    [isOnline, t, session?.access_token]
  );

  return {
    logMedication,
    isOnline,
  };
}
