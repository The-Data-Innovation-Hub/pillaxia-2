/**
 * Native (Capacitor) auth flow using backend token exchange.
 * Workaround for AADSTS9002326: Entra rejects token redemption when the request
 * origin is capacitor://localhost. We exchange the auth code on our backend (HTTPS)
 * and return tokens to the app.
 */

const NATIVE_TOKENS_KEY = 'pillaxia_native_tokens';
const PKCE_STATE_PREFIX = 'pillaxia_pkce_';

function getAuthority(): string {
  const raw =
    import.meta.env.VITE_ENTRA_EXTERNAL_ID_AUTHORITY ||
    import.meta.env.VITE_AZURE_AUTHORITY ||
    '';
  let s = raw.trim().replace(/\s+/g, '').replace(/\/+$/, '') || '/';
  if (!s.startsWith('http')) s = `https://${s}`;
  if (!s.endsWith('/')) s += '/';
  return s;
}

function getClientId(): string {
  return (
    import.meta.env.VITE_ENTRA_CLIENT_ID ||
    import.meta.env.VITE_AZURE_CLIENT_ID ||
    ''
  );
}

function getScopes(): string[] {
  const env =
    import.meta.env.VITE_ENTRA_SCOPES ||
    import.meta.env.VITE_AZURE_B2C_SCOPES;
  if (env) return env.split(',').map((s: string) => s.trim()).filter(Boolean);
  return ['openid', 'profile', 'email'];
}

export function getRedirectUri(): string {
  const env =
    import.meta.env.VITE_ENTRA_REDIRECT_URI ||
    import.meta.env.VITE_AZURE_REDIRECT_URI;
  if (env) return env.trim().replace(/\/+$/, '');
  return 'capacitor://localhost';
}

/** Web app redirect URI for OAuth callback (e.g. https://app.example.com/auth/callback) */
export function getWebRedirectUri(): string {
  const env =
    import.meta.env.VITE_ENTRA_REDIRECT_URI ||
    import.meta.env.VITE_AZURE_REDIRECT_URI;
  if (env) {
    const base = env.trim().replace(/\/+$/, '');
    // If env is origin-only (no path), append /auth/callback so Entra redirects to the callback route
    if (base && !base.replace(/^https?:\/\//i, '').includes('/')) {
      return `${base}/auth/callback`;
    }
    return base;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return '';
}

function getFunctionsBase(): string {
  const raw = (import.meta.env.VITE_AZURE_FUNCTIONS_URL || '').trim().replace(/\/+$/, '');
  return raw || '';
}

/**
 * Generate a random base64url string for state / code_verifier.
 * PKCE requires code_verifier to be 43–128 chars from [A-Za-z0-9\-._~].
 * We use proper base64url encoding of random bytes so Entra accepts it (avoids AADSTS90013).
 */
function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 hash and base64url encode (for code_challenge) */
async function sha256Base64Url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface NativeAuthUrlResult {
  url: string;
  state: string;
  codeVerifier: string;
}

/**
 * Build the authorization URL for the native PKCE flow and return
 * state + code_verifier so the app can store them and use on redirect.
 */
export async function buildNativeAuthUrl(): Promise<NativeAuthUrlResult> {
  const authority = getAuthority();
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const scopes = getScopes();
  if (!authority || !clientId) {
    throw new Error('Native auth: VITE_ENTRA_CLIENT_ID and authority must be set');
  }

  const state = randomBase64Url(16);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const base = authority.replace(/\/v2\.0\/?$/, '').replace(/\/$/, '');
  const authUrl = `${base}/oauth2/v2.0/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })}`;

  return { url: authUrl, state, codeVerifier };
}

/**
 * Build the authorization URL for the web PKCE flow (redirect_uri = origin + /auth/callback).
 * Use this for browser-based sign-in; store state/codeVerifier and redirect user to url.
 */
export async function buildWebAuthUrl(): Promise<NativeAuthUrlResult> {
  const authority = getAuthority();
  const clientId = getClientId();
  const redirectUri = getWebRedirectUri();
  const scopes = getScopes();
  if (!authority || !clientId) {
    throw new Error('Web auth: VITE_ENTRA_CLIENT_ID and authority must be set');
  }
  if (!redirectUri) {
    throw new Error('Web auth: redirect URI could not be determined (set VITE_ENTRA_REDIRECT_URI or run in browser)');
  }

  const state = randomBase64Url(16);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const base = authority.replace(/\/v2\.0\/?$/, '').replace(/\/$/, '');
  const authUrl = `${base}/oauth2/v2.0/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })}`;

  return { url: authUrl, state, codeVerifier };
}

/**
 * Store PKCE code_verifier in sessionStorage so we can retrieve it when
 * the redirect comes back (keyed by state).
 */
export function storePkceVerifier(state: string, codeVerifier: string): void {
  try {
    sessionStorage.setItem(PKCE_STATE_PREFIX + state, codeVerifier);
  } catch {
    // ignore
  }
}

/**
 * Retrieve and remove the code_verifier for the given state.
 */
export function takePkceVerifier(state: string): string | null {
  try {
    const key = PKCE_STATE_PREFIX + state;
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

export interface NativeTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  stored_at: number;
}

export function getStoredNativeTokens(): NativeTokens | null {
  try {
    const raw = localStorage.getItem(NATIVE_TOKENS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as NativeTokens;
    return data?.access_token ? data : null;
  } catch {
    return null;
  }
}

/** Return current user id (sub) from stored id_token, or null. Used by libs that cannot use React context. */
export function getCurrentUserId(): string | null {
  const tokens = getStoredNativeTokens();
  const idToken = tokens?.id_token;
  if (!idToken) return null;
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload)) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

export function setStoredNativeTokens(tokens: {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
}): void {
  localStorage.setItem(
    NATIVE_TOKENS_KEY,
    JSON.stringify({
      ...tokens,
      stored_at: Date.now(),
    })
  );
}

export function clearStoredNativeTokens(): void {
  try {
    localStorage.removeItem(NATIVE_TOKENS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Exchange the authorization code for tokens via our backend (avoids
 * AADSTS9002326 by not sending Origin: capacitor://localhost from the client).
 * On native (Capacitor), uses CapacitorHttp so the request is not subject to
 * WKWebView "Load failed" when fetching from capacitor:// to HTTPS.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ access_token: string; id_token?: string; refresh_token?: string; expires_in?: number }> {
  const base = getFunctionsBase();
  if (!base) throw new Error('VITE_AZURE_FUNCTIONS_URL is not set');
  const url = `${base}/api/auth-exchange-native`;
  const body = { code, code_verifier: codeVerifier, redirect_uri: redirectUri };

  // On native, use CapacitorHttp so the request is not blocked by WKWebView (Load failed).
  let useNativeHttp = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    useNativeHttp = Capacitor.isNativePlatform();
  } catch {
    // @capacitor/core not available (e.g. web-only build)
  }

  if (useNativeHttp) {
    try {
      const { CapacitorHttp } = await import('@capacitor/core');
      const res = await CapacitorHttp.post({
        url,
        headers: { 'Content-Type': 'application/json' },
        data: body,
      });
      const status = res.status ?? 0;
      const data = (res.data != null ? res.data : {}) as Record<string, unknown>;
      if (status >= 200 && status < 300) {
        return data as { access_token: string; id_token?: string; refresh_token?: string; expires_in?: number };
      }
      const msg =
        (data?.error && String(data.error)) ||
        (data?.error_description && String(data.error_description)) ||
        res.statusText ||
        `HTTP ${status}`;
      throw new Error(`Token exchange failed (${status}): ${msg}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Token exchange failed (')) throw e;
      const networkMsg = e instanceof Error ? e.message : String(e);
      throw new Error(`Network error during token exchange: ${networkMsg}`);
    }
  }

  // Web: use fetch
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const networkMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error during token exchange: ${networkMsg}`);
  }
  let raw: string;
  try {
    raw = await res.text();
  } catch (e) {
    const readMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Token exchange: failed to read response (${res.status}): ${readMsg}`);
  }
  let data: Record<string, unknown>;
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Token exchange failed (${res.status}): ${raw?.slice(0, 200) || 'empty response'}`);
  }
  if (!res.ok) {
    const msg =
      (data?.error && String(data.error)) ||
      (data?.error_description && String(data.error_description)) ||
      raw?.slice(0, 200) ||
      res.statusText;
    throw new Error(`Token exchange failed (${res.status}): ${msg}`);
  }
  return data as { access_token: string; id_token?: string; refresh_token?: string; expires_in?: number };
}

/**
 * Decode JWT payload (no verification; we trust the token from our backend).
 */
export function decodeIdTokenPayload(idToken: string): { sub?: string; email?: string; oid?: string } {
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return {};
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      sub: payload.sub,
      email: payload.email ?? payload.preferred_username,
      oid: payload.oid,
    };
  } catch {
    return {};
  }
}

/** Parse code and state from redirect URL (query or hash) */
export function getCodeAndStateFromUrl(url: string): { code: string | null; state: string | null } {
  try {
    const u = new URL(url);
    let code = u.searchParams.get('code');
    let state = u.searchParams.get('state');
    if ((!code || !state) && u.hash) {
      const hashParams = new URLSearchParams(u.hash.replace(/^#/, ''));
      code = code || hashParams.get('code');
      state = state || hashParams.get('state');
    }
    return { code, state };
  } catch {
    return { code: null, state: null };
  }
}
