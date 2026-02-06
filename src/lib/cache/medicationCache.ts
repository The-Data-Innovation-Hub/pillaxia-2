// IndexedDB cache for medications - uses centralized cache manager
import type { Tables } from "@/types/database";
import { cacheManager, STORES } from "./cacheManager";

type Medication = Tables<"medications"> & {
  medication_schedules: Array<{
    time_of_day: string;
    quantity: number;
  }>;
};

const CACHE_KEY_PREFIX = "medications-";

class MedicationCache {
  async saveMedications(userId: string, medications: Medication[]): Promise<void> {
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

  async getMedications(userId: string): Promise<Medication[]> {
    const medications = await cacheManager.getAllByIndex<Medication>(
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
