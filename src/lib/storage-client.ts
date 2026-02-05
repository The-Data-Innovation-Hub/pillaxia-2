/**
 * Unified storage client - switches between Supabase and Azure Blob
 * Use this instead of supabase.storage directly when migrating
 */

import { supabase } from '@/integrations/supabase/client';
import { createAzureStorageClient } from './azure-storage';

const useAzure = import.meta.env.VITE_USE_AZURE_AUTH === 'true';

let azureStorage: ReturnType<typeof createAzureStorageClient> | null = null;

export function getStorageClient() {
  if (useAzure) {
    if (!azureStorage) {
      azureStorage = createAzureStorageClient();
    }
    return azureStorage;
  }
  return supabase.storage;
}
