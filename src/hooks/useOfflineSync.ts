import { useEffect, useRef, useCallback, useState } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import { offlineQueue, SyncResult } from "@/lib/offlineQueue";
import { symptomCache } from "@/lib/symptomCache";
import { conflictManager } from "@/lib/conflictResolution";
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
  const [conflictCount, setConflictCount] = useState(0);

  const updateConflictCount = useCallback(async () => {
    try {
      const { unresolved } = await conflictManager.getConflictCount();
      setConflictCount(unresolved);
    } catch (error) {
      console.error("[useOfflineSync] Failed to get conflict count:", error);
    }
  }, []);

  const syncPendingActions = useCallback(async (): Promise<SyncResult | null> => {
    if (isSyncing.current) return null;

    try {
      const pendingCount = await offlineQueue.getPendingCount();
      if (pendingCount === 0) {
        // Still update last sync time even if nothing to sync
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem("pillaxia_last_sync", now.toISOString());
        await updateConflictCount();
        return { success: 0, failed: 0, conflicts: 0, conflictIds: [] };
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

      if (result.conflicts > 0) {
        toast.warning(`${result.conflicts} conflict(s) detected - review needed`, {
          duration: 5000,
          action: {
            label: "View",
            onClick: () => {
              window.location.href = "/dashboard/sync-status";
            },
          },
        });
      }

      // Update conflict count
      await updateConflictCount();

      // Update last sync time
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem("pillaxia_last_sync", now.toISOString());

      return result;
    } catch (error) {
      console.error("[useOfflineSync] Sync error:", error);
      toast.error(t.offline.syncError);
      return null;
    } finally {
      isSyncing.current = false;
      setSyncInProgress(false);
    }
  }, [t, onSyncComplete, queryClient, updateConflictCount]);

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
        // Always update conflict count when becoming visible
        updateConflictCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isOnline, syncPendingActions, updateConflictCount]);

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

  // Initial conflict count load
  useEffect(() => {
    updateConflictCount();
  }, [updateConflictCount]);

  return {
    syncPendingActions,
    isOnline,
    syncInProgress,
    lastSyncTime,
    conflictCount,
    updateConflictCount,
  };
}
