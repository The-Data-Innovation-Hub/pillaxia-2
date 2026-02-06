import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from "@capacitor/push-notifications";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface NativePushState {
  isNative: boolean;
  isSupported: boolean;
  isRegistered: boolean;
  isLoading: boolean;
  permission: "prompt" | "granted" | "denied";
  token: string | null;
}

export function useNativePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NativePushState>({
    isNative: false,
    isSupported: false,
    isRegistered: false,
    isLoading: true,
    permission: "prompt",
    token: null,
  });

  // Check if running on native platform
  const isNativePlatform = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

  // Initialize and check current state
  useEffect(() => {
    const init = async () => {
      if (!isNativePlatform) {
        setState(prev => ({ ...prev, isNative: false, isSupported: false, isLoading: false }));
        return;
      }

      setState(prev => ({ ...prev, isNative: true, isSupported: true }));

      try {
        // Check current permission status
        const permStatus = await PushNotifications.checkPermissions();
        setState(prev => ({
          ...prev,
          permission: permStatus.receive as "prompt" | "granted" | "denied",
          isLoading: false,
        }));
      } catch (error) {
        console.error("Error checking push permissions:", error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, [isNativePlatform]);

  // Set up listeners for push events
  useEffect(() => {
    if (!isNativePlatform) return;

    // Registration success
    const registrationListener = PushNotifications.addListener("registration", async (token: Token) => {
      console.log("Push registration success, token:", token.value);
      setState(prev => ({ ...prev, token: token.value, isRegistered: true }));

      // Save token to database
      if (user) {
        await saveNativeToken(token.value, platform as "ios" | "android");
      }
    });

    // Registration error
    const errorListener = PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error);
      setState(prev => ({ ...prev, isRegistered: false }));
      toast({
        title: "Push registration failed",
        description: error.error || "Could not register for push notifications",
        variant: "destructive",
      });
    });

    // Notification received while app is in foreground
    const receivedListener = PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
      console.log("Push notification received:", notification);
      // Show local notification or handle in-app
      toast({
        title: notification.title || "Notification",
        description: notification.body || "",
      });
    });

    // Notification action performed (user tapped notification)
    const actionListener = PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      console.log("Push notification action:", action);
      const data = action.notification.data;
      
      // Handle navigation based on notification data
      if (data?.url) {
        window.location.href = data.url;
      }
    });

    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      receivedListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isNativePlatform, user, platform]);

  // Save native token to database
  const saveNativeToken = async (token: string, devicePlatform: "ios" | "android") => {
    if (!user) return;

    try {
      const { error } = await db.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: `native://${devicePlatform}/${token.slice(0, 32)}`, // Unique identifier
          p256dh: "native", // Placeholder for native
          auth: "native", // Placeholder for native
          native_token: token,
          platform: devicePlatform,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        console.error("Error saving native token:", error);
        throw error;
      }

      console.log("Native push token saved successfully");
    } catch (error) {
      console.error("Failed to save native token:", error);
    }
  };

  // Request permissions and register
  const register = useCallback(async () => {
    if (!isNativePlatform || !user) {
      toast({
        title: "Not available",
        description: "Native push notifications require the mobile app.",
        variant: "destructive",
      });
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive !== "granted") {
        setState(prev => ({
          ...prev,
          permission: permStatus.receive as "prompt" | "granted" | "denied",
          isLoading: false,
        }));
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your device settings.",
          variant: "destructive",
        });
        return false;
      }

      setState(prev => ({ ...prev, permission: "granted" }));

      // Register with APNs/FCM
      await PushNotifications.register();

      setState(prev => ({ ...prev, isLoading: false }));

      toast({
        title: "Push notifications enabled",
        description: "You'll receive medication reminders on this device.",
      });

      return true;
    } catch (error) {
      console.error("Error registering for push:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      toast({
        title: "Registration failed",
        description: "Could not enable push notifications. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  }, [isNativePlatform, user]);

  // Unregister and remove token
  const unregister = useCallback(async () => {
    if (!user || !state.token) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Remove from database
      await db
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("native_token", state.token);

      setState(prev => ({
        ...prev,
        isRegistered: false,
        token: null,
        isLoading: false,
      }));

      toast({
        title: "Push notifications disabled",
        description: "You won't receive push notifications on this device.",
      });

      return true;
    } catch (error) {
      console.error("Error unregistering push:", error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, state.token]);

  return {
    ...state,
    platform,
    register,
    unregister,
  };
}
