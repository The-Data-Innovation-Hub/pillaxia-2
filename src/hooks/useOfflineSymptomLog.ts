import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
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
    async (params: SymptomEntryParams): Promise<boolean> => {
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
          const { error } = await supabase
            .from("symptom_entries")
            .insert(insertData);

          if (error) throw error;
          return true;
        } catch (error) {
          console.error("[useOfflineSymptomLog] Online insert failed:", error);
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
            type: "symptom_entry",
            url: `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/symptom_entries`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${accessToken}`,
              Prefer: "return=minimal",
            },
            body: insertData,
          });

          toast.info(t.offline.symptomQueuedForSync || t.offline.queuedForSync);
          return true;
        } catch (error) {
          console.error("[useOfflineSymptomLog] Queue failed:", error);
          toast.error(t.offline.queueFailed);
          return false;
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
