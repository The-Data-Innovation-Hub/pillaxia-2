// Offline Queue for pending actions when network is unavailable

import { conflictManager, ConflictEntry, AutoResolutionResult } from "./conflictResolution";

export interface PendingAction {
  id?: number;
  type: "medication_log" | "symptom_entry" | "message";
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
  // For conflict detection
  resourceId?: string; // The ID of the resource being modified
}

export interface SyncResult {
  success: number;
  failed: number;
  conflicts: number;
  conflictIds: string[];
  autoResolved: number;
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

  // Check server state for conflict detection
  private async checkServerState(action: PendingAction): Promise<{
    hasConflict: boolean;
    serverData: Record<string, unknown> | null;
    conflictType: ConflictEntry["conflictType"] | null;
  }> {
    // Only check for PATCH/PUT operations that modify existing records
    if (action.method === "POST") {
      return { hasConflict: false, serverData: null, conflictType: null };
    }

    try {
      // Extract resource ID from URL for GET request
      const url = new URL(action.url);
      const getUrl = url.origin + url.pathname + url.search;
      
      // Make a GET request to check current server state
      const response = await fetch(getUrl, {
        method: "GET",
        headers: {
          ...action.headers,
          "Prefer": "return=representation",
        },
      });

      if (response.status === 404 || response.status === 406) {
        // Resource was deleted
        return { hasConflict: true, serverData: null, conflictType: "delete_conflict" };
      }

      if (!response.ok) {
        // Can't determine conflict, proceed with sync
        return { hasConflict: false, serverData: null, conflictType: null };
      }

      const data = await response.json();
      const serverData = Array.isArray(data) ? data[0] : data;
      
      if (!serverData) {
        return { hasConflict: true, serverData: null, conflictType: "delete_conflict" };
      }

      // Check for conflict using the manager
      const { hasConflict, conflictType } = conflictManager.detectConflict(
        action.body as Record<string, unknown>,
        serverData,
        action.timestamp
      );

      return { hasConflict, serverData, conflictType };
    } catch (error) {
      console.error("[OfflineQueue] Failed to check server state:", error);
      return { hasConflict: false, serverData: null, conflictType: null };
    }
  }

  // Sync all pending actions when back online with conflict detection
  async syncAll(skipConflictCheck = false): Promise<SyncResult> {
    const actions = await this.getActions();
    let success = 0;
    let failed = 0;
    let conflicts = 0;
    let autoResolved = 0;
    const conflictIds: string[] = [];

    for (const action of actions) {
      try {
        // Check for conflicts before syncing (unless skipped)
        if (!skipConflictCheck && action.method !== "POST") {
          const conflictCheck = await this.checkServerState(action);
          
          if (conflictCheck.hasConflict && conflictCheck.conflictType) {
            // Try to add conflict - if null is returned, it was auto-resolved
            const conflictData = {
              type: action.type as "medication_log" | "symptom_entry",
              localData: action.body as Record<string, unknown>,
              serverData: conflictCheck.serverData,
              conflictType: conflictCheck.conflictType,
              localTimestamp: action.timestamp,
              serverTimestamp: conflictCheck.serverData?.updated_at as string || 
                              conflictCheck.serverData?.created_at as string,
              actionId: action.id!,
            };

            // Check for auto-resolution first
            const autoResolution = conflictManager.checkAutoResolution(conflictData);
            
            if (autoResolution.canAutoResolve && autoResolution.resolvedData) {
              // Auto-resolve: sync with the resolved data
              console.log("[OfflineQueue] Auto-resolving conflict:", autoResolution.reason);
              
              const dataToSync = autoResolution.resolution === "keep_local" 
                ? action.body 
                : autoResolution.resolvedData;
              
              const response = await fetch(action.url, {
                method: action.method,
                headers: action.headers,
                body: JSON.stringify(dataToSync),
              });

              if (response.ok) {
                await this.removeAction(action.id!);
                success++;
                autoResolved++;
                console.log("[OfflineQueue] Auto-resolved and synced:", action.id, autoResolution.resolution);
              } else {
                console.error("[OfflineQueue] Auto-resolved sync failed:", action.id, response.status);
                failed++;
              }
              continue;
            }

            // Cannot auto-resolve, create conflict for manual resolution
            const conflictId = await conflictManager.addConflict(conflictData);
            
            if (conflictId) {
              conflicts++;
              conflictIds.push(conflictId);
              console.log("[OfflineQueue] Conflict detected for action:", action.id, conflictCheck.conflictType);
            }
            continue; // Skip this action, needs user resolution
          }
        }

        // Proceed with sync
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: JSON.stringify(action.body),
        });

        if (response.ok) {
          await this.removeAction(action.id!);
          success++;
        } else {
          const errorText = await response.text();
          console.error("[OfflineQueue] Sync failed:", action.id, response.status, errorText);
          failed++;
        }
      } catch (error) {
        console.error("[OfflineQueue] Failed to sync action:", action.id, error);
        failed++;
      }
    }

    return { success, failed, conflicts, conflictIds, autoResolved };
  }

  // Force sync a specific action (after conflict resolution)
  async forceSyncAction(actionId: number): Promise<boolean> {
    const actions = await this.getActions();
    const action = actions.find(a => a.id === actionId);
    
    if (!action) {
      console.warn("[OfflineQueue] Action not found:", actionId);
      return false;
    }

    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: JSON.stringify(action.body),
      });

      if (response.ok) {
        await this.removeAction(actionId);
        return true;
      } else {
        console.error("[OfflineQueue] Force sync failed:", actionId, response.status);
        return false;
      }
    } catch (error) {
      console.error("[OfflineQueue] Force sync error:", actionId, error);
      return false;
    }
  }

  // Discard a pending action (used when keeping server version)
  async discardAction(actionId: number): Promise<void> {
    await this.removeAction(actionId);
  }

  // Sync with merged data (after conflict resolution with merge)
  async syncWithMergedData(actionId: number, mergedData: Record<string, unknown>): Promise<boolean> {
    const actions = await this.getActions();
    const action = actions.find(a => a.id === actionId);
    
    if (!action) {
      console.warn("[OfflineQueue] Action not found for merge:", actionId);
      return false;
    }

    try {
      // Use the merged data instead of the original action body
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: JSON.stringify(mergedData),
      });

      if (response.ok) {
        await this.removeAction(actionId);
        console.log("[OfflineQueue] Merged data synced successfully:", actionId);
        return true;
      } else {
        console.error("[OfflineQueue] Merge sync failed:", actionId, response.status);
        return false;
      }
    } catch (error) {
      console.error("[OfflineQueue] Merge sync error:", actionId, error);
      return false;
    }
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
