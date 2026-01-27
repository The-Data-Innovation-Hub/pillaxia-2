// Conflict Resolution for Offline Sync
// Detects and manages conflicts between local offline changes and server data

import { supabase } from "@/integrations/supabase/client";

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
      request.onsuccess = () => {
        // Send push notification for the new conflict
        this.sendConflictPushNotification(entry).catch(err => {
          console.warn("[ConflictManager] Failed to send conflict push:", err);
        });
        resolve(id);
      };
    });
  }

  // Send push notification when a conflict is detected
  private async sendConflictPushNotification(conflict: ConflictEntry): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[ConflictManager] No user session, skipping push notification");
        return;
      }

      const typeLabel = this.getTypeLabel(conflict.type);
      const conflictLabel = conflict.conflictType === "update_conflict" 
        ? "was modified on another device"
        : conflict.conflictType === "delete_conflict"
          ? "was deleted on the server"
          : "has outdated data";

      const { error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [user.id],
          payload: {
            title: "Sync Conflict Detected",
            body: `Your ${typeLabel.toLowerCase()} ${conflictLabel}. Review needed.`,
            icon: "/favicon.ico",
            tag: "sync-conflict",
            requireInteraction: true,
            data: {
              url: "/dashboard/sync-status",
              conflictId: conflict.id,
              type: "sync_conflict",
            },
          },
        },
      });

      if (error) {
        console.error("[ConflictManager] Push notification error:", error);
      } else {
        console.log("[ConflictManager] Conflict push notification sent");
      }
    } catch (error) {
      console.error("[ConflictManager] Failed to send push notification:", error);
    }
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

  // Intelligent merge strategies for different field types
  private getMergeStrategy(fieldName: string): MergeStrategy {
    // Fields that should always take the latest value
    const latestWins: string[] = ["status", "taken_at", "severity", "is_read"];
    
    // Fields that should preserve local changes (user intent)
    const localPreferred: string[] = ["notes", "description"];
    
    // Fields that should never be merged (use server as source of truth)
    const serverAuthority: string[] = ["id", "user_id", "created_at", "medication_id", "schedule_id", "scheduled_time"];
    
    // Fields that should combine values
    const combinable: string[] = [];

    if (serverAuthority.includes(fieldName)) return "server";
    if (localPreferred.includes(fieldName)) return "local";
    if (latestWins.includes(fieldName)) return "latest";
    if (combinable.includes(fieldName)) return "combine";
    
    return "latest"; // Default strategy
  }

  // Merge two data objects intelligently
  mergeData(
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    localTimestamp: number
  ): MergeResult {
    const merged: Record<string, unknown> = {};
    const fieldDecisions: FieldMergeDecision[] = [];
    
    // Get all unique keys from both objects
    const allKeys = new Set([
      ...Object.keys(localData),
      ...Object.keys(serverData),
    ]);

    // Exclude internal/meta fields from merge
    const excludeFields = ["_pending", "_localId", "_timestamp", "updated_at"];

    for (const key of allKeys) {
      if (excludeFields.includes(key)) {
        // Use server value for meta fields, or local if server doesn't have it
        merged[key] = serverData[key] ?? localData[key];
        continue;
      }

      const localValue = localData[key];
      const serverValue = serverData[key];
      const strategy = this.getMergeStrategy(key);

      let chosenValue: unknown;
      let source: "local" | "server" | "merged";

      // If values are equal, no conflict
      if (JSON.stringify(localValue) === JSON.stringify(serverValue)) {
        chosenValue = localValue;
        source = "server"; // Arbitrary when equal
      } else {
        switch (strategy) {
          case "server":
            chosenValue = serverValue ?? localValue;
            source = "server";
            break;
            
          case "local":
            chosenValue = localValue ?? serverValue;
            source = "local";
            break;
            
          case "latest": {
            const serverTime = serverData.updated_at 
              ? new Date(serverData.updated_at as string).getTime()
              : serverData.created_at 
                ? new Date(serverData.created_at as string).getTime() 
                : 0;
            
            if (localTimestamp > serverTime) {
              chosenValue = localValue ?? serverValue;
              source = "local";
            } else {
              chosenValue = serverValue ?? localValue;
              source = "server";
            }
            break;
          }
            
          case "combine":
            // For text fields, we could concatenate or use other logic
            if (typeof localValue === "string" && typeof serverValue === "string") {
              if (localValue && serverValue && localValue !== serverValue) {
                chosenValue = `${serverValue}\n---\n${localValue}`;
                source = "merged";
              } else {
                chosenValue = localValue || serverValue;
                source = localValue ? "local" : "server";
              }
            } else {
              chosenValue = localValue ?? serverValue;
              source = "local";
            }
            break;
            
          default:
            chosenValue = localValue ?? serverValue;
            source = "local";
        }
      }

      merged[key] = chosenValue;
      
      // Track decision for transparency
      if (localValue !== undefined || serverValue !== undefined) {
        fieldDecisions.push({
          field: key,
          localValue,
          serverValue,
          mergedValue: chosenValue,
          source,
          strategy,
        });
      }
    }

    // Set updated_at to now for the merged result
    merged.updated_at = new Date().toISOString();

    return {
      mergedData: merged,
      fieldDecisions,
      hasChanges: fieldDecisions.some(d => d.source !== "server" || d.localValue !== d.serverValue),
    };
  }

  // Check if merge is possible (not for delete conflicts)
  canMerge(conflict: ConflictEntry): boolean {
    return conflict.conflictType !== "delete_conflict" && conflict.serverData !== null;
  }

  // Get a preview of what the merged data would look like
  getMergePreview(conflict: ConflictEntry): MergeResult | null {
    if (!this.canMerge(conflict)) return null;
    
    return this.mergeData(
      conflict.localData,
      conflict.serverData as Record<string, unknown>,
      conflict.localTimestamp
    );
  }
}

// Type definitions for merge functionality
export type MergeStrategy = "local" | "server" | "latest" | "combine";

export interface FieldMergeDecision {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  mergedValue: unknown;
  source: "local" | "server" | "merged";
  strategy: MergeStrategy;
}

export interface MergeResult {
  mergedData: Record<string, unknown>;
  fieldDecisions: FieldMergeDecision[];
  hasChanges: boolean;
}

export const conflictManager = new ConflictResolutionManager();
