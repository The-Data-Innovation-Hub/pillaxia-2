import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listMedications } from "@/integrations/azure/data";
import { medicationCache } from "@/lib/cache";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export type Medication = {
  id: string;
  user_id: string;
  name: string;
  dosage: string | null;
  form: string | null;
  instructions: string | null;
  prescribed_by: string | null;
  pharmacy_id: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
} & {
  medication_schedules: Array<{ time_of_day: string; quantity: number }>;
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
      const data = await listMedications(user.id);
      const medicationData = (Array.isArray(data) ? data : []) as Medication[];
      medicationData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
