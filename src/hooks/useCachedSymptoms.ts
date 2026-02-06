import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { symptomCache, type CachedSymptomEntry } from "@/lib/cache";
import { useOfflineStatus } from "./useOfflineStatus";

interface UseCachedSymptomsResult {
  symptoms: CachedSymptomEntry[];
  loading: boolean;
  isFromCache: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  hasPending: boolean;
}

export function useCachedSymptoms(): UseCachedSymptomsResult {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const [symptoms, setSymptoms] = useState<CachedSymptomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasPending, setHasPending] = useState(false);

  const loadFromCache = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const cachedSymptoms = await symptomCache.getSymptoms(user.id);
      if (cachedSymptoms.length > 0) {
        setSymptoms(cachedSymptoms);
        setIsFromCache(true);
        setHasPending(cachedSymptoms.some(s => s._pending));
        const timestamp = await symptomCache.getCacheTimestamp(user.id);
        if (timestamp) {
          setLastUpdated(new Date(timestamp));
        }
        return true;
      }
    } catch (error) {
      console.error("Error loading from symptom cache:", error);
    }
    return false;
  }, [user]);

  const fetchFromNetwork = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await db
        .from("symptom_entries")
        .select(`
          *,
          medications (name)
        `)
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const typedSymptoms = (data || []) as CachedSymptomEntry[];

      // Cache should never block rendering network data.
      let pendingSymptoms: CachedSymptomEntry[] = [];
      try {
        pendingSymptoms = await symptomCache.getPendingSymptoms(user.id);
      } catch (cacheError) {
        console.warn("Symptom cache unavailable (pending symptoms):", cacheError);
      }

      // Merge: pending first, then synced
      const mergedSymptoms = [...pendingSymptoms, ...typedSymptoms];
      mergedSymptoms.sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      );

      setSymptoms(mergedSymptoms);
      setIsFromCache(false);
      setLastUpdated(new Date());
      setHasPending(pendingSymptoms.length > 0);

      // Save to cache for offline access (only synced entries)
      try {
        await symptomCache.saveSymptoms(user.id, typedSymptoms);
      } catch (cacheError) {
        console.warn("Symptom cache unavailable (save):", cacheError);
      }
    } catch (error) {
      console.error("Error fetching symptoms from network:", error);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    
    // Clear current state to force re-render
    setSymptoms([]);
    setLoading(true);
    
    if (isOnline) {
      await fetchFromNetwork();
    } else {
      await loadFromCache();
    }
    
    setLoading(false);
  }, [user, isOnline, fetchFromNetwork, loadFromCache]);

  // Initial load: cache first, then network
  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // First, try to load from cache for instant display
      const hasCached = await loadFromCache();
      if (hasCached) {
        setLoading(false);
      }

      // Then fetch fresh data from network if online
      if (isOnline) {
        await fetchFromNetwork();
      }
      
      setLoading(false);
    };

    initialize();
  }, [user, isOnline, loadFromCache, fetchFromNetwork]);

  return {
    symptoms,
    loading,
    isFromCache,
    lastUpdated,
    refresh,
    hasPending,
  };
}
