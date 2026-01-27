// Offline Queue for pending actions when network is unavailable

interface PendingAction {
  id?: number;
  type: "medication_log" | "symptom_entry" | "message";
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

const DB_NAME = "pillaxia-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-actions";

class OfflineQueue {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  async addAction(action: Omit<PendingAction, "id" | "timestamp">): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const actionWithTimestamp: PendingAction = {
        ...action,
        timestamp: Date.now(),
      };

      const request = store.add(actionWithTimestamp);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as number);
    });
  }

  async getActions(): Promise<PendingAction[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async removeAction(id: number): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPendingCount(): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Sync all pending actions when back online
  async syncAll(): Promise<{ success: number; failed: number }> {
    const actions = await this.getActions();
    let success = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: JSON.stringify(action.body),
        });

        if (response.ok) {
          await this.removeAction(action.id!);
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error("[OfflineQueue] Failed to sync action:", action.id, error);
        failed++;
      }
    }

    return { success, failed };
  }

  // Request background sync if available
  async requestBackgroundSync(tag: string = "sync-pending-actions"): Promise<boolean> {
    if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
        return true;
      } catch (error) {
        console.error("[OfflineQueue] Background sync registration failed:", error);
        return false;
      }
    }
    return false;
  }
}

export const offlineQueue = new OfflineQueue();
