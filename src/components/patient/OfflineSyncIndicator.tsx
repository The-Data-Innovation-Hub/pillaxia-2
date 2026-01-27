import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { offlineQueue } from "@/lib/offlineQueue";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

interface OfflineSyncIndicatorProps {
  onSyncComplete?: () => void;
}

export function OfflineSyncIndicator({ onSyncComplete }: OfflineSyncIndicatorProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
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
    setIsSyncing(false);
    onSyncComplete?.();
  };

  if (pendingCount === 0 && isOnline) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-primary" />
        <span>{t.offline.allSynced}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Cloud className="h-4 w-4 text-primary" />
        ) : (
          <CloudOff className="h-4 w-4 text-warning" />
        )}
        
        {pendingCount > 0 && (
          <Badge variant="secondary" className={cn(
            "text-xs",
            !isOnline && "bg-warning/20 text-warning-foreground"
          )}>
            {pendingCount} {t.offline.pending}
          </Badge>
        )}
      </div>

      {isOnline && pendingCount > 0 && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="h-7 text-xs"
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", isSyncing && "animate-spin")} />
          {t.offline.syncNow}
        </Button>
      )}
    </div>
  );
}
