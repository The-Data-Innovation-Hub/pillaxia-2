// Centralized IndexedDB cache manager - single source of truth for versioning and stores

const DB_NAME = "pillaxia-cache";
const DB_VERSION = 6; // Increment this when adding new stores or changing schema
const OPEN_DB_TIMEOUT_MS = 5000;

// Store names - all defined in one place
export const STORES = {
  MEDICATIONS: "medications",
  SCHEDULE: "today-schedule",
  SYMPTOMS: "symptoms",
  META: "cache-meta",
  CONFLICTS: "sync-conflicts",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

class CacheManager {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isUpgrading = false;
  private db: IDBDatabase | null = null;

  /**
   * Opens the IndexedDB database, creating stores if needed.
   * All cache modules should use this single instance.
   */
  openDB(): Promise<IDBDatabase> {
    // If we have a valid cached database connection, return it
    if (this.db && !this.isUpgrading) {
      try {
        // Verify the connection is still valid by checking objectStoreNames
        if (this.db.objectStoreNames.length > 0) {
          return Promise.resolve(this.db);
        }
      } catch {
        // Connection is invalid, reset and continue
        this.db = null;
        this.dbPromise = null;
      }
    }

    // If we're currently opening, wait for that to complete
    if (this.dbPromise && !this.isUpgrading) {
      return this.dbPromise;
    }

    // Reset if we were upgrading
    if (this.isUpgrading) {
      this.dbPromise = null;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.isUpgrading = false;
        this.dbPromise = null;
        this.db = null;
        reject(new Error(`IndexedDB open timed out after ${OPEN_DB_TIMEOUT_MS}ms`));
      }, OPEN_DB_TIMEOUT_MS);

      const safeResolve = (db: IDBDatabase) => {
        if (settled) {
          // If we already rejected (e.g. timeout), immediately close to avoid leaks.
          try {
            db.close();
          } catch {
            // ignore
          }
          return;
        }
        settled = true;
        clearTimeout(timeoutId);

        // If another tab triggers a version change, close and force re-open next time.
        db.onversionchange = () => {
          try {
            db.close();
          } finally {
            this.dbPromise = null;
            this.db = null;
          }
        };

        // Handle unexpected close
        db.onclose = () => {
          this.dbPromise = null;
          this.db = null;
        };

        this.isUpgrading = false;
        this.db = db;
        resolve(db);
      };

      const safeReject = (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.isUpgrading = false;
        this.dbPromise = null;
        this.db = null;
        reject(err);
      };

      request.onerror = () => {
        safeReject(request.error);
      };

      request.onsuccess = () => {
        safeResolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        this.isUpgrading = true;
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Handle errors during upgrade
        db.onerror = () => {
          console.error("IndexedDB error during upgrade");
        };
        
        this.createStores(db);
      };

      request.onblocked = () => {
        console.warn("IndexedDB upgrade blocked - close other tabs");
        safeReject(new Error("IndexedDB upgrade blocked (another connection is holding the database open)"));
      };
    });

    return this.dbPromise;
  }

  /**
   * Creates all object stores and indexes.
   * Called during database upgrade.
   */
  private createStores(db: IDBDatabase): void {
    // Medications store
    if (!db.objectStoreNames.contains(STORES.MEDICATIONS)) {
      const medicationsStore = db.createObjectStore(STORES.MEDICATIONS, {
        keyPath: "id",
      });
      medicationsStore.createIndex("user_id", "user_id", { unique: false });
    }

    // Today's schedule store
    if (!db.objectStoreNames.contains(STORES.SCHEDULE)) {
      const scheduleStore = db.createObjectStore(STORES.SCHEDULE, {
        keyPath: "id",
      });
      scheduleStore.createIndex("user_id", "user_id", { unique: false });
      scheduleStore.createIndex("date_key", "date_key", { unique: false });
    }

    // Symptoms store
    if (!db.objectStoreNames.contains(STORES.SYMPTOMS)) {
      const symptomsStore = db.createObjectStore(STORES.SYMPTOMS, {
        keyPath: "id",
      });
      symptomsStore.createIndex("user_id", "user_id", { unique: false });
      symptomsStore.createIndex("pending", "_pending", { unique: false });
    }

    // Cache metadata store (timestamps, counts, etc.)
    if (!db.objectStoreNames.contains(STORES.META)) {
      db.createObjectStore(STORES.META, { keyPath: "key" });
    }

    // Sync conflicts store
    if (!db.objectStoreNames.contains(STORES.CONFLICTS)) {
      const conflictsStore = db.createObjectStore(STORES.CONFLICTS, { keyPath: "id" });
      conflictsStore.createIndex("type", "type", { unique: false });
      conflictsStore.createIndex("resolved", "resolved", { unique: false });
      conflictsStore.createIndex("actionId", "actionId", { unique: false });
    }
  }

  /**
   * Execute a read transaction on one or more stores.
   */
  async readTransaction<T>(
    storeNames: StoreName | StoreName[],
    callback: (transaction: IDBTransaction) => Promise<T> | T
  ): Promise<T> {
    const db = await this.openDB();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = db.transaction(names, "readonly");
    return callback(transaction);
  }

  /**
   * Execute a readwrite transaction on one or more stores.
   */
  async writeTransaction<T>(
    storeNames: StoreName | StoreName[],
    callback: (transaction: IDBTransaction) => Promise<T> | T
  ): Promise<T> {
    const db = await this.openDB();
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = db.transaction(names, "readwrite");
    return callback(transaction);
  }

  /**
   * Get a value from a store by key.
   */
  async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return this.readTransaction(storeName, (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Put a value into a store.
   */
  async put<T>(storeName: StoreName, value: T): Promise<void> {
    return this.writeTransaction(storeName, (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Delete a value from a store by key.
   */
  async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    return this.writeTransaction(storeName, (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Get all values from a store matching an index value.
   */
  /**
   * Check if a value is a valid IDBKey.
   * Valid keys: number, string, Date, ArrayBuffer, arrays of valid keys, and booleans (for index queries).
   */
  private isValidKey(value: unknown): value is IDBValidKey {
    if (value === null || value === undefined) return false;
    const type = typeof value;
    // Booleans are valid keys for IndexedDB indexes
    if (type === "number" || type === "string" || type === "boolean") return true;
    if (value instanceof Date || value instanceof ArrayBuffer) return true;
    if (Array.isArray(value)) return value.every((v) => this.isValidKey(v));
    return false;
  }

  /**
   * Get all values from a store matching an index value.
   */
  async getAllByIndex<T>(
    storeName: StoreName,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    // Guard against invalid keys that would throw DataError
    if (!this.isValidKey(value)) {
      console.warn(`[CacheManager] Invalid key passed to getAllByIndex: ${String(value)}`);
      return [];
    }

    return this.readTransaction(storeName, (tx) => {
      return new Promise((resolve, reject) => {
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(IDBKeyRange.only(value));
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Delete all values from a store matching an index value.
   */
  /**
   * Delete all values from a store matching an index value.
   */
  async deleteAllByIndex(
    storeName: StoreName,
    indexName: string,
    value: IDBValidKey
  ): Promise<void> {
    // Guard against invalid keys that would throw DataError
    if (!this.isValidKey(value)) {
      console.warn(`[CacheManager] Invalid key passed to deleteAllByIndex: ${String(value)}`);
      return;
    }

    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const cursorRequest = index.openKeyCursor(IDBKeyRange.only(value));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    });
  }

  /**
   * Update cache metadata (timestamp, count, etc.).
   */
  async updateMeta(key: string, data: Record<string, unknown>): Promise<void> {
    await this.put(STORES.META, { key, ...data, timestamp: Date.now() });
  }

  /**
   * Get cache metadata by key.
   */
  async getMeta(key: string): Promise<{ timestamp: number; [key: string]: unknown } | undefined> {
    return this.get(STORES.META, key);
  }

  /**
   * Clear the database connection (useful for testing or logout).
   */
  closeConnection(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore
      }
      this.db = null;
    }
    this.dbPromise = null;
  }

  /**
   * Get the current database version.
   */
  getVersion(): number {
    return DB_VERSION;
  }
}

// Export a singleton instance
export const cacheManager = new CacheManager();
