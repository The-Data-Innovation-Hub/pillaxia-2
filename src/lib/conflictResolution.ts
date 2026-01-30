// Conflict Resolution for Offline Sync
// Detects and manages conflicts between local offline changes and server data

import { supabase } from "@/integrations/supabase/client";
import { getAutoResolutionPreferences, type AutoResolutionPreferences } from "@/hooks/useAutoResolutionPreferences";
import { cacheManager, STORES } from "@/lib/cache";

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

class ConflictResolutionManager {
  /**
   * Helper to execute operations on the conflicts store using the centralized cacheManager.
   */
  private async withConflictsStore<T>(
    mode: "readonly" | "readwrite",
    callback: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    const db = await cacheManager.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFLICTS], mode);
      const store = transaction.objectStore(STORES.CONFLICTS);
      callback(store).then(resolve).catch(reject);
    });
  }

  async addConflict(conflict: Omit<ConflictEntry, "id" | "createdAt" | "resolved">): Promise<string | null> {
    // First, check if this conflict can be auto-resolved
    const autoResolution = this.checkAutoResolution(conflict);
    if (autoResolution.canAutoResolve) {
      console.log("[ConflictManager] Auto-resolving conflict:", autoResolution.reason);
      // Return null to indicate no manual resolution needed
      // The caller should use the auto-resolved data
      return null;
    }

    const db = await cacheManager.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFLICTS], "readwrite");
      const store = transaction.objectStore(STORES.CONFLICTS);

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

  // Check if a conflict can be automatically resolved without user intervention
  checkAutoResolution(conflict: Omit<ConflictEntry, "id" | "createdAt" | "resolved">): AutoResolutionResult {
    // Get user preferences
    const prefs = getAutoResolutionPreferences();
    
    // If auto-resolution is disabled, always require manual review
    if (!prefs.enabled) {
      return { canAutoResolve: false, reason: "Auto-resolution is disabled in settings" };
    }

    // Cannot auto-resolve delete conflicts - user must decide
    if (conflict.conflictType === "delete_conflict" || !conflict.serverData) {
      return { canAutoResolve: false, reason: "Delete conflicts require manual resolution" };
    }

    const localData = conflict.localData;
    const serverData = conflict.serverData;
    const timeThresholdMs = prefs.timeDifferenceThreshold * 1000;

    // Get relevant fields (exclude meta fields)
    const excludeFields = ["id", "user_id", "created_at", "updated_at", "_pending", "_localId", "_timestamp"];
    const localFields = Object.entries(localData).filter(([key]) => !excludeFields.includes(key));
    const serverFields = Object.entries(serverData).filter(([key]) => !excludeFields.includes(key));

    // Find differing fields
    const differingFields: DifferingField[] = [];
    
    for (const [key, localValue] of localFields) {
      const serverValue = serverData[key];
      if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
        differingFields.push({
          field: key,
          localValue,
          serverValue,
          strategy: this.getMergeStrategy(key),
        });
      }
    }

    // Check for server-only fields
    for (const [key, serverValue] of serverFields) {
      if (!(key in localData) && !excludeFields.includes(key)) {
        differingFields.push({
          field: key,
          localValue: undefined,
          serverValue,
          strategy: this.getMergeStrategy(key),
        });
      }
    }

    // Case 1: No actual differences - auto-resolve with server data
    if (differingFields.length === 0) {
      return {
        canAutoResolve: true,
        reason: "No meaningful differences between local and server data",
        resolution: "keep_server",
        resolvedData: serverData,
      };
    }

    // Case 2: Only one field differs and it has a clear strategy winner
    if (differingFields.length === 1 && prefs.allowSingleFieldAuto) {
      const diff = differingFields[0];
      
      // Server authority fields - always use server
      if (diff.strategy === "server") {
        return {
          canAutoResolve: true,
          reason: `Single field '${diff.field}' differs and server has authority`,
          resolution: "keep_server",
          resolvedData: serverData,
        };
      }
      
      // Local preferred fields - always use local
      if (diff.strategy === "local") {
        return {
          canAutoResolve: true,
          reason: `Single field '${diff.field}' differs and local is preferred`,
          resolution: "keep_local",
          resolvedData: localData,
        };
      }

      // Latest wins - check timestamps
      if (diff.strategy === "latest") {
        const serverTime = serverData.updated_at 
          ? new Date(serverData.updated_at as string).getTime()
          : serverData.created_at 
            ? new Date(serverData.created_at as string).getTime() 
            : 0;
        
        const timeDiff = Math.abs(conflict.localTimestamp - serverTime);
        
        // Only auto-resolve if there's a clear winner (using user-configured threshold)
        if (timeDiff > timeThresholdMs) {
          if (conflict.localTimestamp > serverTime) {
            return {
              canAutoResolve: true,
              reason: `Single field '${diff.field}' differs and local is newer by ${Math.round(timeDiff / 1000)}s`,
              resolution: "keep_local",
              resolvedData: localData,
            };
          } else {
            return {
              canAutoResolve: true,
              reason: `Single field '${diff.field}' differs and server is newer by ${Math.round(timeDiff / 1000)}s`,
              resolution: "keep_server",
              resolvedData: serverData,
            };
          }
        }
      }
    }

    // Case 3: Multiple fields differ but all have the same clear winner
    if (differingFields.length > 1 && prefs.allowMultiFieldAuto) {
      const allServerAuthority = differingFields.every(d => d.strategy === "server");
      if (allServerAuthority) {
        return {
          canAutoResolve: true,
          reason: `All ${differingFields.length} differing fields have server authority`,
          resolution: "keep_server",
          resolvedData: serverData,
        };
      }

      const allLocalPreferred = differingFields.every(d => d.strategy === "local");
      if (allLocalPreferred) {
        return {
          canAutoResolve: true,
          reason: `All ${differingFields.length} differing fields prefer local`,
          resolution: "keep_local",
          resolvedData: localData,
        };
      }

      // Check if all "latest" strategy fields agree on the same winner
      const latestFields = differingFields.filter(d => d.strategy === "latest");
      if (latestFields.length === differingFields.length) {
        const serverTime = serverData.updated_at 
          ? new Date(serverData.updated_at as string).getTime()
          : serverData.created_at 
            ? new Date(serverData.created_at as string).getTime() 
            : 0;
        
        const timeDiff = Math.abs(conflict.localTimestamp - serverTime);
        
        // Clear time difference for all fields (using user-configured threshold)
        if (timeDiff > timeThresholdMs) {
          if (conflict.localTimestamp > serverTime) {
            return {
              canAutoResolve: true,
              reason: `All ${differingFields.length} differing fields use 'latest' strategy and local is newer`,
              resolution: "keep_local",
              resolvedData: localData,
            };
          } else {
            return {
              canAutoResolve: true,
              reason: `All ${differingFields.length} differing fields use 'latest' strategy and server is newer`,
              resolution: "keep_server",
              resolvedData: serverData,
            };
          }
        }
      }
    }

    // Case 4: Check if auto-merge produces a clean result (no actual conflicts)
    if (prefs.allowAutoMerge && this.canMerge({ ...conflict, id: "", createdAt: "", resolved: false })) {
      const mergePreview = this.mergeData(localData, serverData, conflict.localTimestamp);
      
      // If all decisions are unambiguous (no "merged" source needed for text combining)
      const hasAmbiguousMerge = mergePreview.fieldDecisions.some(
        d => d.source === "merged" || 
             (d.localValue !== d.serverValue && d.localValue !== undefined && d.serverValue !== undefined)
      );
      
      if (!hasAmbiguousMerge) {
        return {
          canAutoResolve: true,
          reason: "Merge produces unambiguous result",
          resolution: "merge",
          resolvedData: mergePreview.mergedData,
        };
      }
    }

    // Cannot auto-resolve
    return {
      canAutoResolve: false,
      reason: `${differingFields.length} fields differ with mixed strategies`,
      differingFields,
    };
  }

  // Get auto-resolution result for a conflict (useful for external callers)
  getAutoResolution(conflict: ConflictEntry): AutoResolutionResult {
    return this.checkAutoResolution(conflict);
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
    try {
      const db = await cacheManager.openDB();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = db.transaction([STORES.CONFLICTS], "readonly");
          const store = transaction.objectStore(STORES.CONFLICTS);
          
          // Check if index exists before using it
          if (!store.indexNames.contains("resolved")) {
            // Fallback: get all and filter
            const allRequest = store.getAll();
            allRequest.onerror = () => reject(allRequest.error);
            allRequest.onsuccess = () => {
              const all = allRequest.result as ConflictEntry[];
              resolve(all.filter(c => !c.resolved));
            };
            return;
          }
          
          const index = store.index("resolved");
          const request = index.getAll(IDBKeyRange.only(false));

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        } catch (err) {
          // Fallback on any IndexedDB error
          console.warn("[ConflictResolution] Index query failed, using fallback:", err);
          resolve([]);
        }
      });
    } catch (err) {
      console.warn("[ConflictResolution] getUnresolvedConflicts failed:", err);
      return [];
    }
  }

  async getAllConflicts(): Promise<ConflictEntry[]> {
    const db = await cacheManager.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFLICTS], "readonly");
      const store = transaction.objectStore(STORES.CONFLICTS);
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
    const db = await cacheManager.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFLICTS], "readonly");
      const store = transaction.objectStore(STORES.CONFLICTS);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async resolveConflict(
    id: string, 
    resolution: "keep_local" | "keep_server" | "merge"
  ): Promise<void> {
    const db = await cacheManager.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFLICTS], "readwrite");
      const store = transaction.objectStore(STORES.CONFLICTS);
      
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
    const db = await cacheManager.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CONFLICTS], "readwrite");
      const store = transaction.objectStore(STORES.CONFLICTS);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearResolvedConflicts(): Promise<void> {
    try {
      const db = await cacheManager.openDB();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = db.transaction([STORES.CONFLICTS], "readwrite");
          const store = transaction.objectStore(STORES.CONFLICTS);
          
          // Check if index exists before using it
          if (!store.indexNames.contains("resolved")) {
            // Fallback: get all and delete resolved ones manually
            const allRequest = store.getAll();
            allRequest.onerror = () => reject(allRequest.error);
            allRequest.onsuccess = () => {
              const all = allRequest.result as ConflictEntry[];
              const resolved = all.filter(c => c.resolved);
              resolved.forEach(c => store.delete(c.id));
              transaction.oncomplete = () => resolve();
            };
            return;
          }
          
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
        } catch (err) {
          console.warn("[ConflictResolution] clearResolvedConflicts index failed:", err);
          resolve();
        }
      });
    } catch (err) {
      console.warn("[ConflictResolution] clearResolvedConflicts failed:", err);
    }
  }

  async getConflictCount(): Promise<{ total: number; unresolved: number }> {
    try {
      const db = await cacheManager.openDB();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = db.transaction([STORES.CONFLICTS], "readonly");
          const store = transaction.objectStore(STORES.CONFLICTS);
          const totalRequest = store.count();
          
          totalRequest.onsuccess = () => {
            const total = totalRequest.result;
            
            // Check if index exists before using it
            if (!store.indexNames.contains("resolved")) {
              // Fallback: get all and count unresolved manually
              const allRequest = store.getAll();
              allRequest.onerror = () => reject(allRequest.error);
              allRequest.onsuccess = () => {
                const all = allRequest.result as ConflictEntry[];
                const unresolved = all.filter(c => !c.resolved).length;
                resolve({ total, unresolved });
              };
              return;
            }
            
            const index = store.index("resolved");
            const unresolvedRequest = index.count(IDBKeyRange.only(false));
            
            unresolvedRequest.onerror = () => reject(unresolvedRequest.error);
            unresolvedRequest.onsuccess = () => {
              resolve({ total, unresolved: unresolvedRequest.result });
            };
          };
          totalRequest.onerror = () => reject(totalRequest.error);
        } catch (err) {
          console.warn("[ConflictResolution] getConflictCount index failed:", err);
          resolve({ total: 0, unresolved: 0 });
        }
      });
    } catch (err) {
      console.warn("[ConflictResolution] getConflictCount failed:", err);
      return { total: 0, unresolved: 0 };
    }
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

// Auto-resolution types
export interface DifferingField {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  strategy: MergeStrategy;
}

export interface AutoResolutionResult {
  canAutoResolve: boolean;
  reason: string;
  resolution?: "keep_local" | "keep_server" | "merge";
  resolvedData?: Record<string, unknown>;
  differingFields?: DifferingField[];
}

export const conflictManager = new ConflictResolutionManager();
