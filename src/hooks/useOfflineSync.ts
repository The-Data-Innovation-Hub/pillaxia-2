import { useEffect, useRef, useCallback, useState } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue } from "@/lib/offlineQueue";
import { symptomCache } from "@/lib/symptomCache";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";

export function useOfflineSync(onSyncComplete?: () => void) {
  const { isOnline, wasOffline } = useOfflineStatus();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isSyncing = useRef(false);
  const hasAttemptedSync = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem("pillaxia_last_sync");
    return stored ? new Date(stored) : null;
  });
  const [syncInProgress, setSyncInProgress] = useState(false);

  const syncPendingActions = useCallback(async () => {
    if (isSyncing.current) return;

    try {
      const pendingCount = await offlineQueue.getPendingCount();
      if (pendingCount === 0) {
        // Still update last sync time even if nothing to sync
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem("pillaxia_last_sync", now.toISOString());
        return;
      }

      isSyncing.current = true;
      setSyncInProgress(true);
      toast.info(t.offline.syncing);

      const result = await offlineQueue.syncAll();

      if (result.success > 0) {
        // Clear pending symptoms from cache after successful sync
        await symptomCache.clearPendingSymptoms();
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["medications"] });
        queryClient.invalidateQueries({ queryKey: ["medication-logs"] });
        queryClient.invalidateQueries({ queryKey: ["symptoms"] });
        queryClient.invalidateQueries({ queryKey: ["today-schedule"] });
        
        toast.success(t.offline.syncSuccess);
        onSyncComplete?.();
      }

      if (result.failed > 0) {
        toast.error(t.offline.syncFailed);
      }

      // Update last sync time
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem("pillaxia_last_sync", now.toISOString());
    } catch (error) {
      console.error("[useOfflineSync] Sync error:", error);
      toast.error(t.offline.syncError);
    } finally {
      isSyncing.current = false;
      setSyncInProgress(false);
    }
  }, [t, onSyncComplete, queryClient]);

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

  // Sync when app becomes visible (user returns to tab/app)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isOnline) {
        const pendingCount = await offlineQueue.getPendingCount();
        if (pendingCount > 0) {
          syncPendingActions();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isOnline, syncPendingActions]);

  // Periodic sync check when online (every 30 seconds)
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(async () => {
      const pendingCount = await offlineQueue.getPendingCount();
      if (pendingCount > 0 && !isSyncing.current) {
        syncPendingActions();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, syncPendingActions]);

  return {
    syncPendingActions,
    isOnline,
    syncInProgress,
    lastSyncTime,
  };
}
