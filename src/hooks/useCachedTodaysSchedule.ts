import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listMedicationLogs, updateMedicationLog } from "@/integrations/azure/data";
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

      const data = await listMedicationLogs(user.id, { from: start, to: end });
      const typedLogs = (data || []).sort(
        (a, b) =>
          new Date((a.scheduled_time as string) || 0).getTime() -
          new Date((b.scheduled_time as string) || 0).getTime()
      ) as CachedMedicationLog[];

      setLogs(typedLogs);
      setIsFromCache(false);
      setLastUpdated(new Date());

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
    setLogs((prev) =>
      prev.map((log) =>
        log.id === logId ? { ...log, status, taken_at: takenAt || log.taken_at } : log
      )
    );

    try {
      await scheduleCache.updateLogStatus(logId, status, takenAt);
    } catch (error) {
      console.error("Error updating cache:", error);
    }

    if (isOnline) {
      try {
        const payload: Record<string, unknown> = { status };
        if (takenAt != null) payload.taken_at = takenAt;
        await updateMedicationLog(logId, payload);
      } catch (error) {
        console.error("Error updating log on server:", error);
      }
    }
  }, [isOnline]);

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
    logs,
    loading,
    isFromCache,
    lastUpdated,
    refresh,
    updateLogStatus,
  };
}
