import { useEffect, useRef, useCallback } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export function useOfflineSync(onSyncComplete?: () => void) {
  const { isOnline, wasOffline } = useOfflineStatus();
  const { t } = useLanguage();
  const isSyncing = useRef(false);
  const hasAttemptedSync = useRef(false);

  const syncPendingActions = useCallback(async () => {
    if (isSyncing.current) return;

    try {
      const pendingCount = await offlineQueue.getPendingCount();
      if (pendingCount === 0) return;

      isSyncing.current = true;
      toast.info(t.offline.syncing);

      const result = await offlineQueue.syncAll();

      if (result.success > 0) {
        toast.success(t.offline.syncSuccess);
        onSyncComplete?.();
      }

      if (result.failed > 0) {
        toast.error(t.offline.syncFailed);
      }
    } catch (error) {
      console.error("[useOfflineSync] Sync error:", error);
      toast.error(t.offline.syncError);
    } finally {
      isSyncing.current = false;
    }
  }, [t, onSyncComplete]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && !hasAttemptedSync.current) {
      hasAttemptedSync.current = true;
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        syncPendingActions();
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Reset flag when going offline
    if (!isOnline) {
      hasAttemptedSync.current = false;
    }
  }, [isOnline, wasOffline, syncPendingActions]);

  // Also try background sync if supported
  useEffect(() => {
    if (isOnline && wasOffline) {
      offlineQueue.requestBackgroundSync("sync-medication-logs");
    }
  }, [isOnline, wasOffline]);

  return {
    syncPendingActions,
    isOnline,
  };
}
