/**
 * Azure API client for data and function calls.
 * Uses Bearer token from stored Entra tokens; base URL from VITE_AZURE_FUNCTIONS_URL or VITE_API_URL.
 */

import { getStoredNativeTokens } from "@/lib/native-auth";

function getBaseUrl(): string {
  const url =
    (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_AZURE_FUNCTIONS_URL ?? "").trim().replace(/\/+$/, "");
  return url;
}

export function getApiBaseUrl(): string {
  return getBaseUrl();
}

export function getAccessToken(): string | null {
  const tokens = getStoredNativeTokens();
  return tokens?.access_token ?? null;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: Error | null;
  status: number;
}

/**
 * Authenticated request to the Azure API. Adds Bearer token and JSON headers.
 */
export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  query?: Record<string, string>
): Promise<ApiResponse<T>> {
  const base = getBaseUrl();
  if (!base) {
    return { data: null, error: new Error("VITE_API_URL or VITE_AZURE_FUNCTIONS_URL is not set"), status: 0 };
  }

  const token = getAccessToken();
  const url = new URL(path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    let data: T | null = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    }

    if (!res.ok) {
      return {
        data,
        error: new Error((data as { error?: string; message?: string })?.error ?? (data as { message?: string })?.message ?? res.statusText),
        status: res.status,
      };
    }

    return { data, error: null, status: res.status };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
      status: 0,
    };
  }
}

/** GET /api/... */
export async function apiGet<T>(path: string, query?: Record<string, string>): Promise<ApiResponse<T>> {
  return apiRequest<T>("GET", path, undefined, query);
}

/** POST /api/... */
export async function apiPost<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>("POST", path, body);
}

/** PATCH /api/... */
export async function apiPatch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>("PATCH", path, body);
}

/** PUT /api/... */
export async function apiPut<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>("PUT", path, body);
}

/** DELETE /api/... */
export async function apiDelete(path: string): Promise<ApiResponse<unknown>> {
  return apiRequest("DELETE", path);
}

/**
 * Upload a file (e.g. logo) via multipart/form-data. Returns JSON with url or error.
 */
export async function apiUpload<T = { url: string }>(
  path: string,
  file: File,
  fieldName = "file"
): Promise<ApiResponse<T>> {
  const base = getBaseUrl();
  if (!base) {
    return { data: null, error: new Error("VITE_API_URL or VITE_AZURE_FUNCTIONS_URL is not set"), status: 0 };
  }
  const token = getAccessToken();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const form = new FormData();
  form.append(fieldName, file);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method: "POST", headers, body: form });
    const text = await res.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    }
    if (!res.ok) {
      return {
        data,
        error: new Error((data as { error?: string })?.error ?? res.statusText),
        status: res.status,
      };
    }
    return { data, error: null, status: res.status };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)), status: 0 };
  }
}

/**
 * Invoke an Azure function (e.g. send-email, trigger job). Maps to POST /api/:functionName.
 */
export async function apiInvoke<T = unknown>(functionName: string, body?: unknown): Promise<ApiResponse<T>> {
  const path = `/api/${functionName.replace(/^\//, "")}`;
  return apiPost<T>(path, body);
}
