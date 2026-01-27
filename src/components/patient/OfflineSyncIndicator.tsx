import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { offlineQueue } from "@/lib/offlineQueue";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface OfflineSyncIndicatorProps {
  onSyncComplete?: () => void;
  showLastSync?: boolean;
  compact?: boolean;
}

export function OfflineSyncIndicator({ 
  onSyncComplete, 
  showLastSync = true,
  compact = false 
}: OfflineSyncIndicatorProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem("pillaxia_last_sync");
    return stored ? new Date(stored) : null;
  });
  const { isOnline } = useOfflineStatus();
  const { syncPendingActions } = useOfflineSync(onSyncComplete);
  const { t } = useLanguage();

  useEffect(() => {
    const updateCount = async () => {
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
    };

    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    await syncPendingActions();
    const count = await offlineQueue.getPendingCount();
    setPendingCount(count);
    
    // Update last sync time
    const now = new Date();
    setLastSyncTime(now);
    localStorage.setItem("pillaxia_last_sync", now.toISOString());
    
    setIsSyncing(false);
    onSyncComplete?.();
  };

  // Update last sync time when sync completes automatically
  useEffect(() => {
    if (isOnline && pendingCount === 0 && !lastSyncTime) {
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem("pillaxia_last_sync", now.toISOString());
    }
  }, [isOnline, pendingCount, lastSyncTime]);

  const formatLastSync = () => {
    if (!lastSyncTime) return t.offline.neverSynced || "Never synced";
    return formatDistanceToNow(lastSyncTime, { addSuffix: true });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isOnline ? (
          <Cloud className="h-3 w-3 text-primary" />
        ) : (
          <CloudOff className="h-3 w-3 text-warning" />
        )}
        {pendingCount > 0 && (
          <span className="text-warning">{pendingCount} {t.offline.pending}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Cloud className="h-5 w-5 text-primary" />
          ) : (
            <CloudOff className="h-5 w-5 text-warning" />
          )}
          <span className="font-medium">
            {isOnline ? (t.offline.online || "Online") : (t.offline.offlineMode || "Offline Mode")}
          </span>
        </div>
        
        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-8"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isSyncing && "animate-spin")} />
            {t.offline.syncNow}
          </Button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        {pendingCount > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn(
              "text-xs",
              !isOnline && "bg-warning/20 text-warning-foreground"
            )}>
              {pendingCount} {t.offline.pending}
            </Badge>
            <span className="text-muted-foreground">
              {t.offline.changesWaiting || "changes waiting to sync"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Check className="h-4 w-4 text-primary" />
            <span>{t.offline.allSynced}</span>
          </div>
        )}

        {showLastSync && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{t.offline.lastSynced || "Last synced"}: {formatLastSync()}</span>
          </div>
        )}
      </div>
    </div>
  );
}
