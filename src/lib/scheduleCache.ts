// IndexedDB cache for today's medication schedule - offline-first

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

const DB_NAME = "pillaxia-cache";
const DB_VERSION = 4; // Must match all cache files using same DB
const SCHEDULE_STORE = "today-schedule";
const META_STORE = "cache-meta";

class ScheduleCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for today's schedule
        if (!db.objectStoreNames.contains(SCHEDULE_STORE)) {
          const store = db.createObjectStore(SCHEDULE_STORE, {
            keyPath: "id",
          });
          store.createIndex("user_id", "user_id", { unique: false });
          store.createIndex("date_key", "date_key", { unique: false });
        }

        // Store for cache metadata (timestamps, etc.)
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }

        // Ensure medications store exists (from medicationCache)
        if (!db.objectStoreNames.contains("medications")) {
          const medStore = db.createObjectStore("medications", {
            keyPath: "id",
          });
          medStore.createIndex("user_id", "user_id", { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  private getDateKey(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  async saveTodaysSchedule(userId: string, logs: CachedMedicationLog[]): Promise<void> {
    const db = await this.openDB();
    const dateKey = this.getDateKey();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULE_STORE, META_STORE], "readwrite");
      const scheduleStore = transaction.objectStore(SCHEDULE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Clear existing schedule for this user and date
      const index = scheduleStore.index("user_id");
      const cursorRequest = index.openKeyCursor(IDBKeyRange.only(userId));
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          scheduleStore.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // After clearing, add new logs with date key
          for (const log of logs) {
            scheduleStore.put({
              ...log,
              user_id: userId,
              date_key: dateKey,
            });
          }
          
          // Update cache timestamp
          metaStore.put({
            key: `schedule-${userId}-${dateKey}`,
            timestamp: Date.now(),
            count: logs.length,
          });
        }
      };
    });
  }

  async getTodaysSchedule(userId: string): Promise<CachedMedicationLog[]> {
    const db = await this.openDB();
    const dateKey = this.getDateKey();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULE_STORE, META_STORE], "readonly");
      const scheduleStore = transaction.objectStore(SCHEDULE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      // First check if cache is for today
      const metaRequest = metaStore.get(`schedule-${userId}-${dateKey}`);
      
      metaRequest.onsuccess = () => {
        if (!metaRequest.result) {
          // No cache for today
          resolve([]);
          return;
        }

        // Get all logs for this user
        const index = scheduleStore.index("user_id");
        const logsRequest = index.getAll(IDBKeyRange.only(userId));

        logsRequest.onerror = () => reject(logsRequest.error);
        logsRequest.onsuccess = () => {
          const logs = logsRequest.result as (CachedMedicationLog & { date_key: string })[];
          // Filter to only today's logs and sort by scheduled time
          const todaysLogs = logs
            .filter(log => log.date_key === dateKey)
            .sort((a, b) => 
              new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
            );
          resolve(todaysLogs);
        };
      };

      metaRequest.onerror = () => reject(metaRequest.error);
    });
  }

  async updateLogStatus(logId: string, status: string, takenAt?: string): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULE_STORE], "readwrite");
      const store = transaction.objectStore(SCHEDULE_STORE);

      const getRequest = store.get(logId);
      
      getRequest.onsuccess = () => {
        const log = getRequest.result;
        if (log) {
          log.status = status;
          if (takenAt) log.taken_at = takenAt;
          store.put(log);
        }
        resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
      transaction.oncomplete = () => resolve();
    });
  }

  async getCacheTimestamp(userId: string): Promise<number | null> {
    const db = await this.openDB();
    const dateKey = this.getDateKey();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([META_STORE], "readonly");
      const store = transaction.objectStore(META_STORE);
      const request = store.get(`schedule-${userId}-${dateKey}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.timestamp || null);
      };
    });
  }

  async clearUserCache(userId: string): Promise<void> {
    const db = await this.openDB();
    const dateKey = this.getDateKey();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SCHEDULE_STORE, META_STORE], "readwrite");
      const scheduleStore = transaction.objectStore(SCHEDULE_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Clear schedule for this user
      const index = scheduleStore.index("user_id");
      const cursorRequest = index.openKeyCursor(IDBKeyRange.only(userId));
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          scheduleStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // Clear meta entry
      metaStore.delete(`schedule-${userId}-${dateKey}`);
    });
  }
}

export const scheduleCache = new ScheduleCache();
