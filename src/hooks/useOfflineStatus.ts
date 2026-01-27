import { useState, useEffect, useCallback } from "react";

interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
}

interface NetworkInformation extends EventTarget {
  effectiveType: "slow-2g" | "2g" | "3g" | "4g";
  downlink: number;
  type?: string;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<{
    type: string | null;
    effectiveType: string | null;
    downlink: number | null;
  }>({
    type: null,
    effectiveType: null,
    downlink: null,
  });

  const updateConnectionInfo = useCallback(() => {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      setConnectionInfo({
        type: connection.type || null,
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
      });
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      updateConnectionInfo();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for connection changes
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      connection.addEventListener("change", updateConnectionInfo);
      updateConnectionInfo();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (connection) {
        connection.removeEventListener("change", updateConnectionInfo);
      }
    };
  }, [updateConnectionInfo]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    connectionType: connectionInfo.type,
    effectiveType: connectionInfo.effectiveType,
    downlink: connectionInfo.downlink,
  };
}
