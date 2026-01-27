// IndexedDB cache for medications and schedules - offline-first
import type { Tables } from "@/integrations/supabase/types";

type Medication = Tables<"medications"> & {
  medication_schedules: Array<{
    time_of_day: string;
    quantity: number;
  }>;
};

const DB_NAME = "pillaxia-cache";
const DB_VERSION = 1;
const MEDICATIONS_STORE = "medications";
const META_STORE = "cache-meta";

class MedicationCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for medications
        if (!db.objectStoreNames.contains(MEDICATIONS_STORE)) {
          const store = db.createObjectStore(MEDICATIONS_STORE, {
            keyPath: "id",
          });
          store.createIndex("user_id", "user_id", { unique: false });
        }

        // Store for cache metadata (timestamps, etc.)
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
    });

    return this.dbPromise;
  }

  async saveMedications(userId: string, medications: Medication[]): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MEDICATIONS_STORE, META_STORE], "readwrite");
      const medicationsStore = transaction.objectStore(MEDICATIONS_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Clear existing medications for this user first
      const index = medicationsStore.index("user_id");
      const cursorRequest = index.openKeyCursor(IDBKeyRange.only(userId));
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          medicationsStore.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          // After clearing, add new medications
          for (const medication of medications) {
            medicationsStore.put(medication);
          }
          
          // Update cache timestamp
          metaStore.put({
            key: `medications-${userId}`,
            timestamp: Date.now(),
            count: medications.length,
          });
        }
      };
    });
  }

  async getMedications(userId: string): Promise<Medication[]> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MEDICATIONS_STORE], "readonly");
      const store = transaction.objectStore(MEDICATIONS_STORE);
      const index = store.index("user_id");
      const request = index.getAll(IDBKeyRange.only(userId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const medications = request.result as Medication[];
        // Sort by created_at descending to match server query
        medications.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        resolve(medications);
      };
    });
  }

  async getCacheTimestamp(userId: string): Promise<number | null> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([META_STORE], "readonly");
      const store = transaction.objectStore(META_STORE);
      const request = store.get(`medications-${userId}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.timestamp || null);
      };
    });
  }

  async clearUserCache(userId: string): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MEDICATIONS_STORE, META_STORE], "readwrite");
      const medicationsStore = transaction.objectStore(MEDICATIONS_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Clear medications for this user
      const index = medicationsStore.index("user_id");
      const cursorRequest = index.openKeyCursor(IDBKeyRange.only(userId));
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          medicationsStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // Clear meta entry
      metaStore.delete(`medications-${userId}`);
    });
  }
}

export const medicationCache = new MedicationCache();
