import { useCallback } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { symptomCache } from "@/lib/cache";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/integrations/azure/client";
import { createSymptomEntry } from "@/integrations/azure/data";

interface SymptomEntryParams {
  userId: string;
  symptomType: string;
  severity: number;
  description?: string | null;
  medicationId?: string | null;
}

export function useOfflineSymptomLog() {
  const { isOnline } = useOfflineStatus();
  const { t } = useLanguage();
  const { session } = useAuth();

  const logSymptom = useCallback(
    async (params: SymptomEntryParams): Promise<{ id: string } | null> => {
      const insertData = {
        user_id: params.userId,
        symptom_type: params.symptomType,
        severity: params.severity,
        description: params.description || null,
        medication_id: params.medicationId || null,
      };

      if (isOnline) {
        try {
          const data = await createSymptomEntry(insertData);
          const id = (data as { id?: string })?.id;
          return id ? { id } : null;
        } catch (error) {
          console.error("[useOfflineSymptomLog] Online insert failed:", error);
          toast.error(t.offline.updateFailed);
          return null;
        }
      } else {
        try {
          const accessToken = session?.access_token;
          if (!accessToken) {
            toast.error(t.offline.notAuthenticated);
            return null;
          }
          const base = getApiBaseUrl();
          if (!base) {
            toast.error(t.offline.updateFailed);
            return null;
          }
          const localId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          await offlineQueue.addAction({
            type: "symptom_entry",
            url: `${base}/api/symptom-entries`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: insertData,
          });

          // Add to local cache for immediate display
          await symptomCache.addPendingSymptom({
            ...insertData,
            recorded_at: new Date().toISOString(),
            medications: null,
            _localId: localId,
            _pending: true,
          });

          toast.info(t.offline.symptomQueuedForSync || t.offline.queuedForSync);
          return { id: localId }; // Return local ID for offline entries
        } catch (error) {
          console.error("[useOfflineSymptomLog] Queue failed:", error);
          toast.error(t.offline.queueFailed);
          return null;
        }
      }
    },
    [isOnline, t, session?.access_token]
  );

  return {
    logSymptom,
    isOnline,
  };
}
