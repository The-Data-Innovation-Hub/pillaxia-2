import { useCallback } from "react";
import { db } from "@/integrations/db";
import { acquireTokenSilent } from "@/lib/azure-auth";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { symptomCache } from "@/lib/cache";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

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
        // Online: Direct insert
        try {
          const { data, error } = await db
            .from("symptom_entries")
            .insert(insertData)
            .select("id")
            .single();

          if (error) throw error;
          return data;
        } catch (error) {
          console.error("[useOfflineSymptomLog] Online insert failed:", error);
          toast.error(t.offline.updateFailed);
          return null;
        }
      } else {
        // Offline: Queue the action AND add to local cache
        try {
          const accessToken = await acquireTokenSilent();

          if (!accessToken) {
            toast.error(t.offline.notAuthenticated);
            return null;
          }

          const apiUrl = import.meta.env.VITE_API_URL;
          const localId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Add to offline queue for sync later
          await offlineQueue.addAction({
            type: "symptom_entry",
            url: `${apiUrl}/rest/symptom_entries`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              Prefer: "return=minimal",
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
          return { id: localId };
        } catch (error) {
          console.error("[useOfflineSymptomLog] Queue failed:", error);
          toast.error(t.offline.queueFailed);
          return null;
        }
      }
    },
    [isOnline, t]
  );

  return {
    logSymptom,
    isOnline,
  };
}
