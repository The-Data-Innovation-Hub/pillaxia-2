import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { medicationCache } from "@/lib/cache";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import type { Tables } from "@/types/database";

type Medication = Tables<"medications"> & {
  medication_schedules: Array<{
    time_of_day: string;
    quantity: number;
  }>;
};

interface UseCachedMedicationsResult {
  medications: Medication[];
  loading: boolean;
  error: Error | null;
  isFromCache: boolean;
  lastSynced: Date | null;
  refetch: () => Promise<void>;
}

export function useCachedMedications(): UseCachedMedicationsResult {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Load from cache first (instant)
  const loadFromCache = useCallback(async () => {
    if (!user) return false;

    try {
      const cached = await medicationCache.getMedications(user.id);
      const timestamp = await medicationCache.getCacheTimestamp(user.id);
      
      if (cached.length > 0) {
        setMedications(cached);
        setIsFromCache(true);
        if (timestamp) {
          setLastSynced(new Date(timestamp));
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("[MedicationCache] Error loading from cache:", err);
      return false;
    }
  }, [user]);

  // Fetch from network and update cache
  const fetchFromNetwork = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await db
        .from("medications")
        .select(`
          *,
          medication_schedules (
            time_of_day,
            quantity
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const medicationData = data as Medication[];
      setMedications(medicationData);
      setIsFromCache(false);
      setLastSynced(new Date());
      setError(null);

      // Save to cache in background
      await medicationCache.saveMedications(user.id, medicationData);
      console.log("[MedicationCache] Saved", medicationData.length, "medications to cache");
    } catch (err) {
      console.error("[MedicationCache] Network fetch error:", err);
      setError(err as Error);
      // If network fails and we don't have cache, show error
      // If we have cache, the cached data is already displayed
    }
  }, [user]);

  // Combined load: cache first, then network
  const loadMedications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Step 1: Load from cache immediately
    const hasCached = await loadFromCache();
    
    // If we have cache, stop showing loading indicator immediately
    if (hasCached) {
      setLoading(false);
    }

    // Step 2: If online, fetch fresh data in background
    if (isOnline) {
      await fetchFromNetwork();
    }

    setLoading(false);
  }, [user, isOnline, loadFromCache, fetchFromNetwork]);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    if (!isOnline) {
      console.log("[MedicationCache] Offline, cannot refresh");
      return;
    }
    setLoading(true);
    await fetchFromNetwork();
    setLoading(false);
  }, [isOnline, fetchFromNetwork]);

  // Initial load
  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && user && medications.length > 0) {
      // We already have data, just refresh in background
      fetchFromNetwork();
    }
  }, [isOnline]); // Only trigger on online status change

  return {
    medications,
    loading,
    error,
    isFromCache,
    lastSynced,
    refetch,
  };
}
