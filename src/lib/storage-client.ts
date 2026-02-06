/**
 * Unified storage client - Azure Blob Storage
 */

import { createAzureStorageClient } from './azure-storage';

let azureStorage: ReturnType<typeof createAzureStorageClient> | null = null;

export function getStorageClient() {
  if (!azureStorage) {
    azureStorage = createAzureStorageClient();
  }
  return azureStorage;
}
