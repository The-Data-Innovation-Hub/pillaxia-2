import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// VAPID public key - this should match your backend
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission | "default";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: "default",
  });

  // Check if push notifications are supported
  const checkSupport = useCallback(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    
    return isSupported;
  }, []);

  // Get current subscription status
  const checkSubscription = useCallback(async () => {
    if (!checkSupport() || !user) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setState({
        isSupported: true,
        isSubscribed: !!subscription,
        isLoading: false,
        permission: Notification.permission,
      });
    } catch (error) {
      console.error("Error checking push subscription:", error);
      setState((prev) => ({
        ...prev,
        isSupported: true,
        isLoading: false,
        permission: Notification.permission,
      }));
    }
  }, [checkSupport, user]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY) {
      toast({
        title: "Push notifications unavailable",
        description: "Push notifications are not configured for this app.",
        variant: "destructive",
      });
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== "granted") {
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push notifications
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Extract keys from subscription
      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys;

      if (!keys?.p256dh || !keys?.auth) {
        throw new Error("Failed to get subscription keys");
      }

      // Save subscription to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      toast({
        title: "Push notifications enabled",
        description: "You'll now receive push notifications for important alerts.",
      });

      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast({
        title: "Failed to enable push notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      toast({
        title: "Push notifications disabled",
        description: "You won't receive push notifications anymore.",
      });

      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      toast({
        title: "Failed to disable push notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
      setState((prev) => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  // Initialize on mount
  useEffect(() => {
    const isSupported = checkSupport();
    setState((prev) => ({ ...prev, isSupported }));

    if (isSupported && user) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => checkSubscription())
        .catch((err) => {
          console.error("Service worker registration failed:", err);
          setState((prev) => ({ ...prev, isLoading: false }));
        });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [checkSupport, checkSubscription, user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
