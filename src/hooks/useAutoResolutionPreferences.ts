import { useState, useCallback, useEffect } from "react";

export interface AutoResolutionPreferences {
  enabled: boolean;
  // Threshold for time difference (in seconds) to consider "clear winner"
  timeDifferenceThreshold: number;
  // Allow auto-resolution for single field differences
  allowSingleFieldAuto: boolean;
  // Allow auto-resolution for multiple field differences with same strategy
  allowMultiFieldAuto: boolean;
  // Allow auto-merge when result is unambiguous
  allowAutoMerge: boolean;
  // Default strategy preference when local and server are both valid
  preferredStrategy: "local" | "server" | "latest";
}

const DEFAULT_PREFERENCES: AutoResolutionPreferences = {
  enabled: true,
  timeDifferenceThreshold: 5, // 5 seconds
  allowSingleFieldAuto: true,
  allowMultiFieldAuto: true,
  allowAutoMerge: true,
  preferredStrategy: "latest",
};

const STORAGE_KEY = "pillaxia_auto_resolution_prefs";

export function useAutoResolutionPreferences() {
  const [preferences, setPreferences] = useState<AutoResolutionPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error("[AutoResolutionPrefs] Failed to load preferences:", error);
    }
    return DEFAULT_PREFERENCES;
  });

  const [isSaving, setIsSaving] = useState(false);

  // Save to localStorage whenever preferences change
  const savePreferences = useCallback((newPrefs: Partial<AutoResolutionPreferences>) => {
    setIsSaving(true);
    try {
      const updated = { ...preferences, ...newPrefs };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setPreferences(updated);
    } catch (error) {
      console.error("[AutoResolutionPrefs] Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  }, [preferences]);

  const resetToDefaults = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
      setPreferences(DEFAULT_PREFERENCES);
    } catch (error) {
      console.error("[AutoResolutionPrefs] Failed to reset preferences:", error);
    }
  }, []);

  return {
    preferences,
    savePreferences,
    resetToDefaults,
    isSaving,
    isDefault: JSON.stringify(preferences) === JSON.stringify(DEFAULT_PREFERENCES),
  };
}

// Utility function to get preferences synchronously (for use in conflictResolution.ts)
export function getAutoResolutionPreferences(): AutoResolutionPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("[AutoResolutionPrefs] Failed to load preferences:", error);
  }
  return DEFAULT_PREFERENCES;
}
