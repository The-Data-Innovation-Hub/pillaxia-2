import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";

interface BiometricState {
  isAvailable: boolean;
  biometryType: BiometryType;
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
}

interface BiometricCredentials {
  username: string;
  password: string;
}

const BIOMETRIC_SERVER = "com.pillaxia.app";
const BIOMETRIC_ENABLED_KEY = "pillaxia_biometric_enabled";

export function useBiometricAuth() {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    biometryType: BiometryType.NONE,
    isEnabled: false,
    isLoading: true,
    error: null,
  });

  // Check if biometrics is available on device
  const checkAvailability = useCallback(async () => {
    // Only available on native platforms
    if (!Capacitor.isNativePlatform()) {
      setState(prev => ({
        ...prev,
        isAvailable: false,
        isLoading: false,
      }));
      return;
    }

    try {
      const result = await NativeBiometric.isAvailable();
      const isEnabled = localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
      
      setState({
        isAvailable: result.isAvailable,
        biometryType: result.biometryType,
        isEnabled,
        isLoading: false,
        error: null,
      });
    } catch (error: unknown) {
      let errorMessage = "Failed to check biometric availability";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setState(prev => ({
        ...prev,
        isAvailable: false,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Get friendly name for biometry type
  const getBiometryName = useCallback(() => {
    switch (state.biometryType) {
      case BiometryType.FACE_ID:
        return "Face ID";
      case BiometryType.TOUCH_ID:
        return "Touch ID";
      case BiometryType.FINGERPRINT:
        return "Fingerprint";
      case BiometryType.FACE_AUTHENTICATION:
        return "Face Authentication";
      case BiometryType.IRIS_AUTHENTICATION:
        return "Iris Authentication";
      case BiometryType.MULTIPLE:
        return "Biometric";
      default:
        return "Biometric";
    }
  }, [state.biometryType]);

  // Verify user identity with biometrics
  const verifyIdentity = useCallback(async (reason?: string): Promise<boolean> => {
    if (!state.isAvailable || !Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: reason || "Authenticate to continue",
        title: "Pillaxia Login",
        subtitle: "Use biometrics to sign in",
        description: "Place your finger on the sensor or look at the camera",
        useFallback: true,
        fallbackTitle: "Use Passcode",
        maxAttempts: 3,
      });
      return true;
    } catch (error) {
      console.error("Biometric verification failed:", error);
      return false;
    }
  }, [state.isAvailable]);

  // Save credentials for biometric login
  const saveCredentials = useCallback(async (credentials: BiometricCredentials): Promise<boolean> => {
    if (!state.isAvailable || !Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      await NativeBiometric.setCredentials({
        username: credentials.username,
        password: credentials.password,
        server: BIOMETRIC_SERVER,
      });
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
      setState(prev => ({ ...prev, isEnabled: true }));
      return true;
    } catch (error) {
      console.error("Failed to save biometric credentials:", error);
      return false;
    }
  }, [state.isAvailable]);

  // Get saved credentials after biometric verification
  const getCredentials = useCallback(async (): Promise<BiometricCredentials | null> => {
    if (!state.isAvailable || !state.isEnabled || !Capacitor.isNativePlatform()) {
      return null;
    }

    try {
      // First verify identity
      const verified = await verifyIdentity("Sign in to Pillaxia");
      if (!verified) {
        return null;
      }

      // Then get credentials
      const credentials = await NativeBiometric.getCredentials({
        server: BIOMETRIC_SERVER,
      });

      return {
        username: credentials.username,
        password: credentials.password,
      };
    } catch (error) {
      console.error("Failed to get biometric credentials:", error);
      return null;
    }
  }, [state.isAvailable, state.isEnabled, verifyIdentity]);

  // Delete saved credentials
  const deleteCredentials = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      await NativeBiometric.deleteCredentials({
        server: BIOMETRIC_SERVER,
      });
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      setState(prev => ({ ...prev, isEnabled: false }));
      return true;
    } catch (error) {
      console.error("Failed to delete biometric credentials:", error);
      return false;
    }
  }, []);

  // Enable biometric login (save credentials and enable)
  const enableBiometric = useCallback(async (email: string, password: string): Promise<boolean> => {
    // First verify identity to confirm user wants to enable
    const verified = await verifyIdentity("Enable biometric login");
    if (!verified) {
      return false;
    }

    return saveCredentials({ username: email, password });
  }, [verifyIdentity, saveCredentials]);

  // Disable biometric login
  const disableBiometric = useCallback(async (): Promise<boolean> => {
    return deleteCredentials();
  }, [deleteCredentials]);

  return {
    ...state,
    biometryName: getBiometryName(),
    verifyIdentity,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    enableBiometric,
    disableBiometric,
    checkAvailability,
  };
}
