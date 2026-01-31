import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Hook for haptic feedback on native platforms
 * Gracefully falls back to no-op on web
 */
export function useHaptics() {
  const isNative = Capacitor.isNativePlatform();

  // Light tap - for button presses, toggles
  const lightTap = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Medium tap - for selections, confirmations
  const mediumTap = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Heavy tap - for important actions
  const heavyTap = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Success feedback - for medication taken, completed actions
  const success = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Warning feedback - for alerts, missed doses
  const warning = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Error feedback - for failures, errors
  const error = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Selection changed - for pickers, sliders
  const selectionChanged = useCallback(async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionChanged();
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  // Vibrate pattern - custom duration
  const vibrate = useCallback(async (duration = 300) => {
    if (!isNative) return;
    try {
      await Haptics.vibrate({ duration });
    } catch (_e) {
      // Haptics not available on this platform
    }
  }, [isNative]);

  return {
    isNative,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    warning,
    error,
    selectionChanged,
    vibrate,
  };
}
