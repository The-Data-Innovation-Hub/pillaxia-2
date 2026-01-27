// IndexedDB cache for today's medication schedule - uses centralized cache manager
import { cacheManager, STORES } from "./cacheManager";

interface CachedMedicationLog {
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

interface StoredScheduleLog extends CachedMedicationLog {
  user_id: string;
  date_key: string;
}

class ScheduleCache {
  private getDateKey(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  private getCacheKey(userId: string): string {
    return `schedule-${userId}-${this.getDateKey()}`;
  }

  async saveTodaysSchedule(userId: string, logs: CachedMedicationLog[]): Promise<void> {
    const dateKey = this.getDateKey();
    
    // Clear existing schedule for this user
    await cacheManager.deleteAllByIndex(STORES.SCHEDULE, "user_id", userId);
    
    // Add new logs with user_id and date_key
    for (const log of logs) {
      const storedLog: StoredScheduleLog = {
        ...log,
        user_id: userId,
        date_key: dateKey,
      };
      await cacheManager.put(STORES.SCHEDULE, storedLog);
    }
    
    // Update cache metadata
    await cacheManager.updateMeta(this.getCacheKey(userId), {
      count: logs.length,
    });
  }

  async getTodaysSchedule(userId: string): Promise<CachedMedicationLog[]> {
    const dateKey = this.getDateKey();
    
    // Check if cache is for today
    const meta = await cacheManager.getMeta(this.getCacheKey(userId));
    if (!meta) {
      return [];
    }
    
    // Get all logs for this user
    const logs = await cacheManager.getAllByIndex<StoredScheduleLog>(
      STORES.SCHEDULE,
      "user_id",
      userId
    );
    
    // Filter to only today's logs and sort by scheduled time
    return logs
      .filter((log) => log.date_key === dateKey)
      .sort(
        (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
      );
  }

  async updateLogStatus(logId: string, status: string, takenAt?: string): Promise<void> {
    const existing = await cacheManager.get<StoredScheduleLog>(STORES.SCHEDULE, logId);
    if (existing) {
      existing.status = status;
      if (takenAt) existing.taken_at = takenAt;
      await cacheManager.put(STORES.SCHEDULE, existing);
    }
  }

  async getCacheTimestamp(userId: string): Promise<number | null> {
    const meta = await cacheManager.getMeta(this.getCacheKey(userId));
    return meta?.timestamp || null;
  }

  async clearUserCache(userId: string): Promise<void> {
    await cacheManager.deleteAllByIndex(STORES.SCHEDULE, "user_id", userId);
    await cacheManager.delete(STORES.META, this.getCacheKey(userId));
  }
}

export const scheduleCache = new ScheduleCache();
