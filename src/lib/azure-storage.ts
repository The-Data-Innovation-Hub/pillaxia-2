/**
 * Azure Blob Storage client
 * Replaces Supabase Storage when VITE_USE_AZURE_AUTH=true
 * Uses API endpoint for uploads (avoids exposing storage credentials to client)
 */

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AzureStorageClient {
  from: (bucket: string) => {
    upload: (
      path: string,
      file: File | Blob,
      options?: { upsert?: boolean }
    ) => Promise<{ error: Error | null }>;
    remove: (paths: string[]) => Promise<{ error: Error | null }>;
    getPublicUrl: (path: string) => { data: { publicUrl: string } };
  };
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { acquireTokenSilent } = await import('@/lib/azure-auth');
  const token = await acquireTokenSilent();
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function createAzureStorageClient(): AzureStorageClient {
  return {
    from: (bucket: string) => ({
      upload: async (
        path: string,
        file: File | Blob,
        _options?: { upsert?: boolean }
      ) => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_URL}/storage/${bucket}/${path}`, {
            method: 'PUT',
            headers,
            body: file,
          });
          if (!res.ok) {
            return { error: new Error(res.statusText) };
          }
          return { error: null };
        } catch (err) {
          return {
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
      },
      remove: async (paths: string[]) => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${API_URL}/storage/${bucket}`, {
            method: 'DELETE',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paths }),
          });
          if (!res.ok) {
            return { error: new Error(res.statusText) };
          }
          return { error: null };
        } catch (err) {
          return {
            error: err instanceof Error ? err : new Error(String(err)),
          };
        }
      },
      getPublicUrl: (path: string) => {
        const storageAccount =
          import.meta.env.VITE_AZURE_STORAGE_ACCOUNT || '';
        const container = bucket;
        const publicUrl =
          storageAccount && container
            ? `https://${storageAccount}.blob.core.windows.net/${container}/${path}`
            : `${API_URL}/storage/${bucket}/${path}`;
        return { data: { publicUrl } };
      },
    }),
  };
}
