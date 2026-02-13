// IndexedDB cache for medications - uses centralized cache manager
import { cacheManager, STORES } from "./cacheManager";

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface CachedMedication extends Medication {
  medication_schedules?: Array<{
    time_of_day: string;
    quantity: number;
  }>;
}

const CACHE_KEY_PREFIX = "medications-";

class MedicationCache {
  async saveMedications(userId: string, medications: CachedMedication[]): Promise<void> {
    // Clear existing medications for this user
    await cacheManager.deleteAllByIndex(STORES.MEDICATIONS, "user_id", userId);
    
    // Add new medications
    for (const medication of medications) {
      await cacheManager.put(STORES.MEDICATIONS, medication);
    }
    
    // Update cache metadata
    await cacheManager.updateMeta(`${CACHE_KEY_PREFIX}${userId}`, {
      count: medications.length,
    });
  }

  async getMedications(userId: string): Promise<CachedMedication[]> {
    const medications = await cacheManager.getAllByIndex<CachedMedication>(
      STORES.MEDICATIONS,
      "user_id",
      userId
    );
    
    // Sort by created_at descending to match server query
    return medications.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getCacheTimestamp(userId: string): Promise<number | null> {
    const meta = await cacheManager.getMeta(`${CACHE_KEY_PREFIX}${userId}`);
    return meta?.timestamp || null;
  }

  async clearUserCache(userId: string): Promise<void> {
    await cacheManager.deleteAllByIndex(STORES.MEDICATIONS, "user_id", userId);
    await cacheManager.delete(STORES.META, `${CACHE_KEY_PREFIX}${userId}`);
  }
}

export const medicationCache = new MedicationCache();
