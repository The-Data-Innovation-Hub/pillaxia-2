import { useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { usePushNotifications } from "./usePushNotifications";
import { useNativePushNotifications } from "./useNativePushNotifications";

/**
 * Unified hook that automatically uses the correct push notification system
 * based on the platform (web vs native iOS/Android)
 */
export function useUnifiedPushNotifications() {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  const webPush = usePushNotifications();
  const nativePush = useNativePushNotifications();

  const unified = useMemo(() => {
    if (isNative) {
      return {
        isSupported: nativePush.isSupported,
        isSubscribed: nativePush.isRegistered,
        isLoading: nativePush.isLoading,
        permission: nativePush.permission,
        platform,
        isNative: true,
        subscribe: nativePush.register,
        unsubscribe: nativePush.unregister,
      };
    }

    return {
      isSupported: webPush.isSupported,
      isSubscribed: webPush.isSubscribed,
      isLoading: webPush.isLoading,
      permission: webPush.permission,
      platform: "web" as const,
      isNative: false,
      subscribe: webPush.subscribe,
      unsubscribe: webPush.unsubscribe,
    };
  }, [isNative, platform, webPush, nativePush]);

  return unified;
}
