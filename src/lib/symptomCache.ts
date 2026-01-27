// IndexedDB cache for symptom entries - offline-first

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

const DB_NAME = "pillaxia-cache";
const DB_VERSION = 3; // Increment for new store
const SYMPTOMS_STORE = "symptoms";
const META_STORE = "cache-meta";

class SymptomCache {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for symptoms
        if (!db.objectStoreNames.contains(SYMPTOMS_STORE)) {
          const store = db.createObjectStore(SYMPTOMS_STORE, {
            keyPath: "id",
          });
          store.createIndex("user_id", "user_id", { unique: false });
          store.createIndex("pending", "_pending", { unique: false });
        }

        // Ensure meta store exists
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }

        // Ensure other stores exist (maintain compatibility)
        if (!db.objectStoreNames.contains("medications")) {
          const medStore = db.createObjectStore("medications", { keyPath: "id" });
          medStore.createIndex("user_id", "user_id", { unique: false });
        }
        if (!db.objectStoreNames.contains("today-schedule")) {
          const schedStore = db.createObjectStore("today-schedule", { keyPath: "id" });
          schedStore.createIndex("user_id", "user_id", { unique: false });
          schedStore.createIndex("date_key", "date_key", { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async saveSymptoms(userId: string, symptoms: CachedSymptomEntry[]): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SYMPTOMS_STORE, META_STORE], "readwrite");
      const symptomsStore = transaction.objectStore(SYMPTOMS_STORE);
      const metaStore = transaction.objectStore(META_STORE);

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
            key: `symptoms-${userId}`,
            timestamp: Date.now(),
            count: symptoms.length,
          });
        }
      };
    });
  }

  async getSymptoms(userId: string): Promise<CachedSymptomEntry[]> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SYMPTOMS_STORE], "readonly");
      const store = transaction.objectStore(SYMPTOMS_STORE);
      const index = store.index("user_id");
      const request = index.getAll(IDBKeyRange.only(userId));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const symptoms = request.result as CachedSymptomEntry[];
        // Sort by recorded_at descending
        symptoms.sort((a, b) => 
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        resolve(symptoms);
      };
    });
  }

  async addPendingSymptom(symptom: Omit<CachedSymptomEntry, "id" | "created_at"> & { _localId: string }): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SYMPTOMS_STORE], "readwrite");
      const store = transaction.objectStore(SYMPTOMS_STORE);

      const pendingEntry: CachedSymptomEntry = {
        ...symptom,
        id: symptom._localId, // Use local ID as temp ID
        created_at: new Date().toISOString(),
        _pending: true,
        _localId: symptom._localId,
      };

      const request = store.put(pendingEntry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async removePendingSymptom(localId: string): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SYMPTOMS_STORE], "readwrite");
      const store = transaction.objectStore(SYMPTOMS_STORE);
      
      const request = store.delete(localId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPendingSymptoms(userId: string): Promise<CachedSymptomEntry[]> {
    const symptoms = await this.getSymptoms(userId);
    return symptoms.filter(s => s._pending);
  }

  async clearPendingSymptoms(): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SYMPTOMS_STORE], "readwrite");
      const store = transaction.objectStore(SYMPTOMS_STORE);
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
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([META_STORE], "readonly");
      const store = transaction.objectStore(META_STORE);
      const request = store.get(`symptoms-${userId}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.timestamp || null);
      };
    });
  }

  async clearUserCache(userId: string): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SYMPTOMS_STORE, META_STORE], "readwrite");
      const symptomsStore = transaction.objectStore(SYMPTOMS_STORE);
      const metaStore = transaction.objectStore(META_STORE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      const index = symptomsStore.index("user_id");
      const cursorRequest = index.openKeyCursor(IDBKeyRange.only(userId));
      
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          symptomsStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      metaStore.delete(`symptoms-${userId}`);
    });
  }
}

export const symptomCache = new SymptomCache();
