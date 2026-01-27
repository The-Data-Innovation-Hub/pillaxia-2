// Force module refresh - v2
import { useEffect, useState } from "react";
import { WifiOff, Wifi, Signal } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const { isOffline, wasOffline, isOnline, effectiveType } = useOfflineStatus();
  const { t } = useLanguage();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (wasOffline && isOnline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline]);

  // Show slow connection warning for 2g or slow-2g
  const isSlowConnection = effectiveType === "2g" || effectiveType === "slow-2g";

  if (!isOffline && !showReconnected && !isSlowConnection) {
    return null;
  }

  const offlineText = t.offline?.banner || "You're offline. Some features may be limited.";
  const reconnectedText = t.offline?.reconnected || "You're back online!";
  const slowText = t.offline?.slowConnection || "Slow connection detected. Data may load slowly.";

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-all duration-300",
        isOffline && "bg-destructive text-destructive-foreground",
        showReconnected && "bg-primary text-primary-foreground",
        isSlowConnection && !isOffline && "bg-secondary text-secondary-foreground"
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>{offlineText}</span>
          </>
        ) : showReconnected ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>{reconnectedText}</span>
          </>
        ) : isSlowConnection ? (
          <>
            <Signal className="h-4 w-4" />
            <span>{slowText}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
