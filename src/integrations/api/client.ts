/**
 * Pillaxia API client for Azure deployment
 * Uses PostgREST-compatible API with Azure AD B2C JWT
 * Replaces Supabase client when VITE_USE_AZURE_AUTH=true
 */

import { acquireTokenSilent } from '@/lib/azure-auth';
import type { Database } from '@/integrations/supabase/types';

function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

const API_URL = getApiBaseUrl();

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await acquireTokenSilent();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchApi(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// PostgREST-compatible interface for table access
function from(table: keyof Database['public']['Tables']) {
  return {
    select: (columns: string) => ({
      eq: (col: string, val: string | number | boolean) => ({
        maybeSingle: async () => {
          const cols = columns.replace(/\s/g, '');
          const res = await fetchApi(`/rest/${table}?${col}=eq.${encodeURIComponent(String(val))}&select=${cols}&limit=1`);
          const data = await parseJson(res);
          return { data: Array.isArray(data) ? data[0] ?? null : data, error: res.ok ? null : new Error(res.statusText) };
        },
        single: async () => {
          const cols = columns.replace(/\s/g, '');
          const res = await fetchApi(`/rest/${table}?${col}=eq.${encodeURIComponent(String(val))}&select=${cols}&limit=1`);
          const data = await parseJson(res);
          return { data: Array.isArray(data) ? data[0] ?? null : data, error: res.ok ? null : new Error(res.statusText) };
        },
        limit: async (n: number) => {
          const cols = columns.replace(/\s/g, '');
          const res = await fetchApi(`/rest/${table}?${col}=eq.${encodeURIComponent(String(val))}&select=${cols}&limit=${n}`);
          const data = await parseJson(res);
          return { data: Array.isArray(data) ? data : [], error: res.ok ? null : new Error(res.statusText) };
        },
      }),
      in: (col: string, vals: string[]) => ({
        limit: async (n: number) => {
          const cols = columns.replace(/\s/g, '');
          const filter = vals.map((v) => `"${v}"`).join(',');
          const res = await fetchApi(`/rest/${table}?${col}=in.(${filter})&select=${cols}&limit=${n}`);
          const data = await parseJson(res);
          return { data: Array.isArray(data) ? data : [], error: res.ok ? null : new Error(res.statusText) };
        },
      }),
    }),
    insert: (body: Record<string, unknown>) => ({
      select: (cols: string) => ({
        single: async () => {
          const res = await fetchApi(`/rest/${table}`, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { Prefer: `return=representation` },
          });
          const data = await parseJson(res);
          return { data: Array.isArray(data) ? data[0] : data, error: res.ok ? null : new Error(res.statusText) };
        },
      }),
    }),
    update: (body: Record<string, unknown>) => ({
      eq: (col: string, val: string | number | boolean) => ({
        select: async (cols: string) => {
          const res = await fetchApi(`/rest/${table}?${col}=eq.${encodeURIComponent(String(val))}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
            headers: { Prefer: 'return=representation' },
          });
          const data = await parseJson(res);
          return { data: Array.isArray(data) ? data : [], error: res.ok ? null : new Error(res.statusText) };
        },
      }),
    }),
    delete: () => ({
      eq: async (col: string, val: string | number | boolean) => {
        const res = await fetchApi(`/rest/${table}?${col}=eq.${encodeURIComponent(String(val))}`, { method: 'DELETE' });
        return { error: res.ok ? null : new Error(res.statusText) };
      },
    }),
  };
}

// Minimal Supabase-compatible client for Azure
export const apiClient = {
  from,
  auth: {
    getSession: async () => {
      const token = await acquireTokenSilent();
      return {
        data: {
          session: token
            ? {
                access_token: token,
                user: { id: '', email: '' },
              }
            : null,
        },
        error: null,
      };
    },
  },
};
