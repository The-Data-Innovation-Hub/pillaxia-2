import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { scheduleCache } from "@/lib/cache";
import { useOfflineStatus } from "./useOfflineStatus";
import { startOfDay, endOfDay } from "date-fns";

export interface CachedMedicationLog {
  id: string;
  scheduled_time: string;
  status: string;
  taken_at: string | null;
  medications: {
    name: string;
    dosage: string;
    dosage_unit: string;
    form: string;
  };
  medication_schedules: {
    quantity: number;
    with_food: boolean;
  };
}

interface UseCachedTodaysScheduleResult {
  logs: CachedMedicationLog[];
  loading: boolean;
  isFromCache: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  updateLogStatus: (logId: string, status: string, takenAt?: string) => Promise<void>;
}

export function useCachedTodaysSchedule(): UseCachedTodaysScheduleResult {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const [logs, setLogs] = useState<CachedMedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadFromCache = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const cachedLogs = await scheduleCache.getTodaysSchedule(user.id);
      if (cachedLogs.length > 0) {
        setLogs(cachedLogs);
        setIsFromCache(true);
        const timestamp = await scheduleCache.getCacheTimestamp(user.id);
        if (timestamp) {
          setLastUpdated(new Date(timestamp));
        }
        return true;
      }
    } catch (error) {
      console.error("Error loading from schedule cache:", error);
    }
    return false;
  }, [user]);

  const fetchFromNetwork = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error } = await db
        .from("medication_logs")
        .select(`
          id,
          scheduled_time,
          status,
          taken_at,
          medications (name, dosage, dosage_unit, form),
          medication_schedules (quantity, with_food)
        `)
        .eq("user_id", user.id)
        .gte("scheduled_time", start)
        .lte("scheduled_time", end)
        .order("scheduled_time", { ascending: true });

      if (error) throw error;

      const typedLogs = (data || []) as CachedMedicationLog[];
      setLogs(typedLogs);
      setIsFromCache(false);
      setLastUpdated(new Date());

      // Save to cache for offline access
      await scheduleCache.saveTodaysSchedule(user.id, typedLogs);
    } catch (error) {
      console.error("Error fetching schedule from network:", error);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    if (isOnline) {
      await fetchFromNetwork();
    } else {
      await loadFromCache();
    }
    
    setLoading(false);
  }, [user, isOnline, fetchFromNetwork, loadFromCache]);

  const updateLogStatus = useCallback(async (logId: string, status: string, takenAt?: string) => {
    // Update local state optimistically
    setLogs(prev => prev.map(log => 
      log.id === logId 
        ? { ...log, status, taken_at: takenAt || log.taken_at }
        : log
    ));

    // Update cache
    try {
      await scheduleCache.updateLogStatus(logId, status, takenAt);
    } catch (error) {
      console.error("Error updating cache:", error);
    }
  }, []);

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
    logs,
    loading,
    isFromCache,
    lastUpdated,
    refresh,
    updateLogStatus,
  };
}
