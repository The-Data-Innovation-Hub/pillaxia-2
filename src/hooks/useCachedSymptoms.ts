import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listSymptomEntries } from "@/integrations/azure/data";
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
        setHasPending(cachedSymptoms.some((s) => s._pending));
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
      const data = await listSymptomEntries(user.id);
      const typedSymptoms = (data || [])
        .sort(
          (a, b) =>
            new Date((b.recorded_at as string) || 0).getTime() -
            new Date((a.recorded_at as string) || 0).getTime()
        )
        .slice(0, 50) as CachedSymptomEntry[];

      let pendingSymptoms: CachedSymptomEntry[] = [];
      try {
        pendingSymptoms = await symptomCache.getPendingSymptoms(user.id);
      } catch (cacheError) {
        console.warn("Symptom cache unavailable (pending symptoms):", cacheError);
      }

      const mergedSymptoms = [...pendingSymptoms, ...typedSymptoms];
      mergedSymptoms.sort(
        (a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      );

      setSymptoms(mergedSymptoms);
      setIsFromCache(false);
      setLastUpdated(new Date());
      setHasPending(pendingSymptoms.length > 0);

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

    setSymptoms([]);
    setLoading(true);

    if (isOnline) {
      await fetchFromNetwork();
    } else {
      await loadFromCache();
    }

    setLoading(false);
  }, [user, isOnline, fetchFromNetwork, loadFromCache]);

  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const hasCached = await loadFromCache();
      if (hasCached) {
        setLoading(false);
      }

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
