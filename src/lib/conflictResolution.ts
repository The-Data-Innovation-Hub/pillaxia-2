// Conflict Resolution for Offline Sync
// Detects and manages conflicts between local offline changes and server data

export interface ConflictEntry {
  id: string;
  type: "medication_log" | "symptom_entry";
  localData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
  conflictType: "update_conflict" | "delete_conflict" | "stale_data";
  localTimestamp: number;
  serverTimestamp?: string;
  actionId: number; // Reference to the pending action
  resolved: boolean;
  resolution?: "keep_local" | "keep_server" | "merge";
  createdAt: string;
}

const DB_NAME = "pillaxia-cache";
const DB_VERSION = 4; // Increment for new store
const CONFLICTS_STORE = "sync-conflicts";

class ConflictResolutionManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create conflicts store
        if (!db.objectStoreNames.contains(CONFLICTS_STORE)) {
          const store = db.createObjectStore(CONFLICTS_STORE, { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("resolved", "resolved", { unique: false });
          store.createIndex("actionId", "actionId", { unique: false });
        }

        // Ensure other stores exist (maintain compatibility)
        if (!db.objectStoreNames.contains("symptoms")) {
          const symptomsStore = db.createObjectStore("symptoms", { keyPath: "id" });
          symptomsStore.createIndex("user_id", "user_id", { unique: false });
          symptomsStore.createIndex("pending", "_pending", { unique: false });
        }
        if (!db.objectStoreNames.contains("cache-meta")) {
          db.createObjectStore("cache-meta", { keyPath: "key" });
        }
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

  async addConflict(conflict: Omit<ConflictEntry, "id" | "createdAt" | "resolved">): Promise<string> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readwrite");
      const store = transaction.objectStore(CONFLICTS_STORE);

      const id = crypto.randomUUID();
      const entry: ConflictEntry = {
        ...conflict,
        id,
        resolved: false,
        createdAt: new Date().toISOString(),
      };

      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(id);
    });
  }

  async getUnresolvedConflicts(): Promise<ConflictEntry[]> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readonly");
      const store = transaction.objectStore(CONFLICTS_STORE);
      const index = store.index("resolved");
      const request = index.getAll(IDBKeyRange.only(false));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllConflicts(): Promise<ConflictEntry[]> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readonly");
      const store = transaction.objectStore(CONFLICTS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const conflicts = request.result as ConflictEntry[];
        // Sort by createdAt descending
        conflicts.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(conflicts);
      };
    });
  }

  async getConflict(id: string): Promise<ConflictEntry | null> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readonly");
      const store = transaction.objectStore(CONFLICTS_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async resolveConflict(
    id: string, 
    resolution: "keep_local" | "keep_server" | "merge"
  ): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readwrite");
      const store = transaction.objectStore(CONFLICTS_STORE);
      
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const conflict = getRequest.result as ConflictEntry;
        if (!conflict) {
          reject(new Error("Conflict not found"));
          return;
        }
        
        conflict.resolved = true;
        conflict.resolution = resolution;
        
        const putRequest = store.put(conflict);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async removeConflict(id: string): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readwrite");
      const store = transaction.objectStore(CONFLICTS_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearResolvedConflicts(): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readwrite");
      const store = transaction.objectStore(CONFLICTS_STORE);
      const index = store.index("resolved");
      const cursorRequest = index.openCursor(IDBKeyRange.only(true));

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    });
  }

  async getConflictCount(): Promise<{ total: number; unresolved: number }> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONFLICTS_STORE], "readonly");
      const store = transaction.objectStore(CONFLICTS_STORE);
      const totalRequest = store.count();
      
      totalRequest.onsuccess = () => {
        const total = totalRequest.result;
        const index = store.index("resolved");
        const unresolvedRequest = index.count(IDBKeyRange.only(false));
        
        unresolvedRequest.onerror = () => reject(unresolvedRequest.error);
        unresolvedRequest.onsuccess = () => {
          resolve({ total, unresolved: unresolvedRequest.result });
        };
      };
      totalRequest.onerror = () => reject(totalRequest.error);
    });
  }

  // Detect if there's a conflict between local and server data
  detectConflict(
    localData: Record<string, unknown>,
    serverData: Record<string, unknown> | null,
    localTimestamp: number
  ): { hasConflict: boolean; conflictType: ConflictEntry["conflictType"] | null } {
    // Server data was deleted
    if (serverData === null) {
      return { hasConflict: true, conflictType: "delete_conflict" };
    }

    // Check if server data was updated after local change
    const serverUpdatedAt = serverData.updated_at as string || serverData.created_at as string;
    if (serverUpdatedAt) {
      const serverTime = new Date(serverUpdatedAt).getTime();
      if (serverTime > localTimestamp) {
        // Server has newer data
        return { hasConflict: true, conflictType: "update_conflict" };
      }
    }

    // Check for stale data (local data is significantly older)
    const ageThreshold = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    if (now - localTimestamp > ageThreshold) {
      return { hasConflict: true, conflictType: "stale_data" };
    }

    return { hasConflict: false, conflictType: null };
  }

  // Get human-readable conflict description
  getConflictDescription(conflict: ConflictEntry): string {
    switch (conflict.conflictType) {
      case "update_conflict":
        return "This entry was modified on another device or by the server while you were offline.";
      case "delete_conflict":
        return "This entry was deleted on the server while you were offline.";
      case "stale_data":
        return "This offline entry is over 24 hours old and may be outdated.";
      default:
        return "A sync conflict was detected.";
    }
  }

  // Get action label based on type
  getTypeLabel(type: ConflictEntry["type"]): string {
    switch (type) {
      case "medication_log":
        return "Medication Log";
      case "symptom_entry":
        return "Symptom Entry";
      default:
        return "Entry";
    }
  }
}

export const conflictManager = new ConflictResolutionManager();
