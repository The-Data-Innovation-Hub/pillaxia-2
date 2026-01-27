// IndexedDB cache for symptom entries - uses centralized cache manager
import { cacheManager, STORES } from "./cacheManager";

export interface CachedSymptomEntry {
  id: string;
  user_id: string;
  symptom_type: string;
  severity: number;
  description: string | null;
  medication_id: string | null;
  recorded_at: string;
  created_at: string;
  medications?: {
    name: string;
  } | null;
  // Local-only fields for pending entries
  _pending?: boolean;
  _localId?: string;
}

const CACHE_KEY_PREFIX = "symptoms-";

class SymptomCache {
  async saveSymptoms(userId: string, symptoms: CachedSymptomEntry[]): Promise<void> {
    const db = await cacheManager.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYMPTOMS, STORES.META], "readwrite");
      const symptomsStore = transaction.objectStore(STORES.SYMPTOMS);
      const metaStore = transaction.objectStore(STORES.META);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Clear existing non-pending symptoms for this user
      const index = symptomsStore.index("user_id");
      const cursorRequest = index.openCursor(IDBKeyRange.only(userId));

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          const entry = cursor.value as CachedSymptomEntry;
          // Only delete synced entries, keep pending ones
          if (!entry._pending) {
            symptomsStore.delete(cursor.primaryKey);
          }
          cursor.continue();
        } else {
          // After clearing, add new symptoms
          for (const symptom of symptoms) {
            symptomsStore.put({ ...symptom, user_id: userId });
          }

          // Update cache timestamp
          metaStore.put({
            key: `${CACHE_KEY_PREFIX}${userId}`,
            timestamp: Date.now(),
            count: symptoms.length,
          });
        }
      };
    });
  }

  async getSymptoms(userId: string): Promise<CachedSymptomEntry[]> {
    const symptoms = await cacheManager.getAllByIndex<CachedSymptomEntry>(
      STORES.SYMPTOMS,
      "user_id",
      userId
    );

    // Sort by recorded_at descending
    return symptoms.sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    );
  }

  async addPendingSymptom(
    symptom: Omit<CachedSymptomEntry, "id" | "created_at"> & { _localId: string }
  ): Promise<void> {
    const pendingEntry: CachedSymptomEntry = {
      ...symptom,
      id: symptom._localId, // Use local ID as temp ID
      created_at: new Date().toISOString(),
      _pending: true,
      _localId: symptom._localId,
    };

    await cacheManager.put(STORES.SYMPTOMS, pendingEntry);
  }

  async removePendingSymptom(localId: string): Promise<void> {
    await cacheManager.delete(STORES.SYMPTOMS, localId);
  }

  async getPendingSymptoms(userId: string): Promise<CachedSymptomEntry[]> {
    const symptoms = await this.getSymptoms(userId);
    return symptoms.filter((s) => s._pending);
  }

  async clearPendingSymptoms(): Promise<void> {
    const db = await cacheManager.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYMPTOMS], "readwrite");
      const store = transaction.objectStore(STORES.SYMPTOMS);
      const request = store.openCursor();

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as CachedSymptomEntry;
          if (entry._pending) {
            store.delete(cursor.primaryKey);
          }
          cursor.continue();
        }
      };
    });
  }

  async getCacheTimestamp(userId: string): Promise<number | null> {
    const meta = await cacheManager.getMeta(`${CACHE_KEY_PREFIX}${userId}`);
    return meta?.timestamp || null;
  }

  async clearUserCache(userId: string): Promise<void> {
    await cacheManager.deleteAllByIndex(STORES.SYMPTOMS, "user_id", userId);
    await cacheManager.delete(STORES.META, `${CACHE_KEY_PREFIX}${userId}`);
  }
}

export const symptomCache = new SymptomCache();
