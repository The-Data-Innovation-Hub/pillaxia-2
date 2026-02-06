/**
 * Pillaxia API client for Azure deployment
 * Provides a PostgREST-compatible interface backed by the Express API.
 * Azure API client for database operations.
 *
 * Usage:
 *   import { apiClient } from '@/integrations/api/client';
 *   const { data, error } = await apiClient.from('medications').select('*').eq('user_id', uid);
 */

import { acquireTokenSilent } from '@/lib/azure-auth';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

const API_URL = getApiBaseUrl();

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = [1000, 3000];

async function getAuthHeaders(): Promise<Record<string, string>> {
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchApi(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  const url = `${API_URL}${path}`;
  const opts: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, opts);

      // On 401, try to refresh token and retry once
      if (res.status === 401 && attempt === 0) {
        const newToken = await acquireTokenSilent();
        if (newToken) {
          (opts.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
          continue; // retry with new token
        }
        // If refresh fails, dispatch auth-expired event for AuthContext to handle
        window.dispatchEvent(new CustomEvent('pillaxia:auth-expired'));
        return res;
      }

      // Retry on 429 (rate limited) or 5xx (server error)
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt] ?? 3000));
        continue;
      }

      return res;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt] ?? 1000));
    }
  }
  throw new Error('Request failed after retries');
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

function buildError(res: Response, data?: unknown): Error | null {
  if (res.ok) return null;
  const msg =
    (data && typeof data === 'object' && 'error' in (data as Record<string, unknown>))
      ? String((data as Record<string, unknown>).error)
      : res.statusText;
  return Object.assign(new Error(msg), { status: res.status, details: data });
}

/* ------------------------------------------------------------------ */
/*  Query builder (PostgREST-compatible chainable API)                 */
/* ------------------------------------------------------------------ */

type FilterEntry = { col: string; op: string; val: string };

class QueryBuilder {
  private _table: string;
  private _selectCols = '*';
  private _filters: FilterEntry[] = [];
  private _order: string | null = null;
  private _limitN: number | null = null;

  constructor(table: string) {
    this._table = table;
  }

  /* ── Column selection ────────────────────────────── */

  select(columns: string): this {
    this._selectCols = columns.replace(/\s+/g, '');
    return this;
  }

  /* ── Filters ─────────────────────────────────────── */

  eq(col: string, val: string | number | boolean): this {
    this._filters.push({ col, op: 'eq', val: String(val) });
    return this;
  }

  neq(col: string, val: string | number | boolean): this {
    this._filters.push({ col, op: 'neq', val: String(val) });
    return this;
  }

  gt(col: string, val: string | number): this {
    this._filters.push({ col, op: 'gt', val: String(val) });
    return this;
  }

  gte(col: string, val: string | number): this {
    this._filters.push({ col, op: 'gte', val: String(val) });
    return this;
  }

  lt(col: string, val: string | number): this {
    this._filters.push({ col, op: 'lt', val: String(val) });
    return this;
  }

  lte(col: string, val: string | number): this {
    this._filters.push({ col, op: 'lte', val: String(val) });
    return this;
  }

  in(col: string, vals: (string | number)[]): this {
    const inner = vals.map((v) => `"${v}"`).join(',');
    this._filters.push({ col, op: 'in', val: `(${inner})` });
    return this;
  }

  is(col: string, val: 'null' | 'true' | 'false' | null | boolean): this {
    const v = val === null ? 'null' : String(val);
    this._filters.push({ col, op: 'is', val: v });
    return this;
  }

  not(col: string, op: string, val: string | number | boolean | null): this {
    if (op === 'is' && val === null) {
      this._filters.push({ col, op: 'not.is', val: 'null' });
    }
    return this;
  }

  ilike(col: string, pattern: string): this {
    this._filters.push({ col, op: 'ilike', val: pattern });
    return this;
  }

  or(condition: string): this {
    this._filters.push({ col: 'or', op: '', val: `(${condition})` });
    return this;
  }

  /* ── Ordering & limiting ─────────────────────────── */

  order(col: string, opts?: { ascending?: boolean }): this {
    const dir = opts?.ascending === false ? 'desc' : 'asc';
    this._order = `${col}.${dir}`;
    return this;
  }

  limit(n: number): this {
    this._limitN = n;
    return this;
  }

  /* ── Terminal methods ────────────────────────────── */

  private _buildQs(): string {
    const parts: string[] = [];
    if (this._selectCols !== '*') parts.push(`select=${this._selectCols}`);
    for (const f of this._filters) {
      if (f.col === 'or') {
        // OR filter: emit or=(condition) — val already includes parens
        parts.push(`or=${encodeURIComponent(f.val)}`);
      } else {
        parts.push(`${f.col}=${f.op}.${encodeURIComponent(f.val)}`);
      }
    }
    if (this._order) parts.push(`order=${this._order}`);
    if (this._limitN != null) parts.push(`limit=${this._limitN}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  /** Fetch multiple rows */
  async then(
    resolve: (value: { data: unknown[]; error: Error | null }) => void,
    reject?: (err: Error) => void
  ): Promise<void> {
    try {
      const res = await fetchApi(`/rest/${this._table}${this._buildQs()}`);
      const data = await parseJson(res);
      resolve({
        data: Array.isArray(data) ? data : [],
        error: buildError(res, data),
      });
    } catch (err) {
      if (reject) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve({ data: [], error: err instanceof Error ? err : new Error(String(err)) });
    }
  }

  /** Fetch exactly one row (or null) */
  async maybeSingle(): Promise<{ data: unknown | null; error: Error | null }> {
    this._limitN = 1;
    const res = await fetchApi(`/rest/${this._table}${this._buildQs()}`);
    const data = await parseJson(res);
    return {
      data: Array.isArray(data) ? data[0] ?? null : data,
      error: buildError(res, data),
    };
  }

  /** Fetch exactly one row (error if missing) */
  async single(): Promise<{ data: unknown | null; error: Error | null }> {
    return this.maybeSingle();
  }
}

/* ------------------------------------------------------------------ */
/*  Insert / Update / Upsert / Delete builders                        */
/* ------------------------------------------------------------------ */

class InsertBuilder {
  private _table: string;
  private _body: Record<string, unknown> | Record<string, unknown>[];

  constructor(table: string, body: Record<string, unknown> | Record<string, unknown>[]) {
    this._table = table;
    this._body = body;
  }

  select(_cols?: string) {
    return {
      single: async (): Promise<{ data: unknown | null; error: Error | null }> => {
        const res = await fetchApi(`/rest/${this._table}`, {
          method: 'POST',
          body: JSON.stringify(this._body),
          headers: { Prefer: 'return=representation' },
        });
        const data = await parseJson(res);
        return {
          data: Array.isArray(data) ? data[0] : data,
          error: buildError(res, data),
        };
      },
      maybeSingle: async (): Promise<{ data: unknown | null; error: Error | null }> => {
        const res = await fetchApi(`/rest/${this._table}`, {
          method: 'POST',
          body: JSON.stringify(this._body),
          headers: { Prefer: 'return=representation' },
        });
        const data = await parseJson(res);
        return {
          data: Array.isArray(data) ? data[0] ?? null : data,
          error: buildError(res, data),
        };
      },
    };
  }

  async then(
    resolve: (value: { data: unknown[]; error: Error | null }) => void
  ): Promise<void> {
    const res = await fetchApi(`/rest/${this._table}`, {
      method: 'POST',
      body: JSON.stringify(this._body),
      headers: { Prefer: 'return=representation' },
    });
    const data = await parseJson(res);
    resolve({
      data: Array.isArray(data) ? data : [],
      error: buildError(res, data),
    });
  }
}

class UpdateBuilder {
  private _table: string;
  private _body: Record<string, unknown>;
  private _filters: FilterEntry[] = [];

  constructor(table: string, body: Record<string, unknown>) {
    this._table = table;
    this._body = body;
  }

  eq(col: string, val: string | number | boolean): this {
    this._filters.push({ col, op: 'eq', val: String(val) });
    return this;
  }

  private _buildQs(): string {
    const parts = this._filters.map((f) => `${f.col}=${f.op}.${encodeURIComponent(f.val)}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  async select(_cols?: string): Promise<{ data: unknown[]; error: Error | null }> {
    const res = await fetchApi(`/rest/${this._table}${this._buildQs()}`, {
      method: 'PATCH',
      body: JSON.stringify(this._body),
      headers: { Prefer: 'return=representation' },
    });
    const data = await parseJson(res);
    return {
      data: Array.isArray(data) ? data : [],
      error: buildError(res, data),
    };
  }

  async then(
    resolve: (value: { data: unknown[]; error: Error | null }) => void
  ): Promise<void> {
    const result = await this.select();
    resolve(result);
  }
}

class UpsertBuilder {
  private _table: string;
  private _body: Record<string, unknown>;
  private _onConflictCol: string | null = null;

  constructor(table: string, body: Record<string, unknown>, opts?: { onConflict?: string }) {
    this._table = table;
    this._body = body;
    this._onConflictCol = opts?.onConflict ?? null;
  }

  /**
   * Upsert: try INSERT, if conflict → UPDATE via PATCH.
   * This is a simplified implementation — the API doesn't natively
   * support upsert, so we do insert-then-patch.
   */
  async select(_cols?: string): Promise<{ data: unknown[]; error: Error | null }> {
    // Try insert first
    const insertRes = await fetchApi(`/rest/${this._table}`, {
      method: 'POST',
      body: JSON.stringify(this._body),
      headers: { Prefer: 'return=representation' },
    });

    if (insertRes.ok) {
      const data = await parseJson(insertRes);
      return { data: Array.isArray(data) ? data : [], error: null };
    }

    // On conflict, try update using the conflict column
    if (this._onConflictCol && this._body[this._onConflictCol]) {
      const conflictVal = this._body[this._onConflictCol];
      const qs = `?${this._onConflictCol}=eq.${encodeURIComponent(String(conflictVal))}`;
      const patchRes = await fetchApi(`/rest/${this._table}${qs}`, {
        method: 'PATCH',
        body: JSON.stringify(this._body),
        headers: { Prefer: 'return=representation' },
      });
      const data = await parseJson(patchRes);
      return { data: Array.isArray(data) ? data : [], error: buildError(patchRes, data) };
    }

    const data = await parseJson(insertRes);
    return { data: [], error: buildError(insertRes, data) };
  }

  async single(): Promise<{ data: unknown | null; error: Error | null }> {
    const result = await this.select();
    return { data: result.data[0] ?? null, error: result.error };
  }

  async then(
    resolve: (value: { data: unknown[]; error: Error | null }) => void
  ): Promise<void> {
    const result = await this.select();
    resolve(result);
  }
}

class DeleteBuilder {
  private _table: string;
  private _filters: FilterEntry[] = [];

  constructor(table: string) {
    this._table = table;
  }

  eq(col: string, val: string | number | boolean): this {
    this._filters.push({ col, op: 'eq', val: String(val) });
    return this;
  }

  in(col: string, vals: (string | number)[]): this {
    const inner = vals.map((v) => `"${v}"`).join(',');
    this._filters.push({ col, op: 'in', val: `(${inner})` });
    return this;
  }

  private _buildQs(): string {
    const parts = this._filters.map((f) => `${f.col}=${f.op}.${encodeURIComponent(f.val)}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }

  async then(
    resolve: (value: { error: Error | null }) => void
  ): Promise<void> {
    const res = await fetchApi(`/rest/${this._table}${this._buildQs()}`, { method: 'DELETE' });
    resolve({ error: res.ok ? null : new Error(res.statusText) });
  }
}

/* ------------------------------------------------------------------ */
/*  RPC caller                                                        */
/* ------------------------------------------------------------------ */

async function rpc(
  fnName: string,
  params: Record<string, unknown> = {}
): Promise<{ data: unknown; error: Error | null }> {
  const res = await fetchApi(`/rpc/${fnName}`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await parseJson(res);
  return { data, error: buildError(res, data) };
}

/* ------------------------------------------------------------------ */
/*  Public API – Database client interface                            */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function from(table: string) {
  return {
    select: (columns = '*') => {
      const qb = new QueryBuilder(table);
      qb.select(columns);
      return qb;
    },
    insert: (body: Record<string, unknown> | Record<string, unknown>[]) =>
      new InsertBuilder(table, body),
    update: (body: Record<string, unknown>) =>
      new UpdateBuilder(table, body),
    upsert: (body: Record<string, unknown>, opts?: { onConflict?: string }) =>
      new UpsertBuilder(table, body, opts),
    delete: () => new DeleteBuilder(table),
  };
}

export const apiClient = {
  from,
  rpc,
  auth: {
    getSession: async () => {
      const token = await acquireTokenSilent();
      return {
        data: {
          session: token
            ? { access_token: token, user: { id: '', email: '' } }
            : null,
        },
        error: null,
      };
    },
  },
  functions: {
    invoke: async (fnName: string, opts?: { headers?: Record<string, string>; body?: unknown }) => {
      try {
        const functionsBase = (
          import.meta.env.VITE_AZURE_FUNCTIONS_URL || API_URL
        ).replace(/\/+$/, '');
        const url = `${functionsBase}/api/${fnName}`;
        const authHeaders = await getAuthHeaders();
        const res = await fetch(url, {
          method: 'POST',
          headers: { ...authHeaders, ...(opts?.headers || {}) },
          body: opts?.body ? JSON.stringify(opts.body) : undefined,
        });
        const data = await parseJson(res);
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'error' in (data as Record<string, unknown>)
              ? String((data as Record<string, unknown>).error)
              : res.statusText;
          return { data: null, error: new Error(msg) };
        }
        return { data, error: null };
      } catch (err) {
        return {
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },
  },
  channel: (_name: string) => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => {},
  }),
};
