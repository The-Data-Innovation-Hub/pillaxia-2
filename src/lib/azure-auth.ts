/**
 * Azure customer identity (B2C or Entra External ID) auth wrapper
 * Azure AD B2C authentication via MSAL.
 * Supports: Azure AD B2C (existing tenants) or Microsoft Entra External ID (new tenants)
 */

import {
  PublicClientApplication,
  AccountInfo,
  AuthenticationResult,
  Configuration,
} from '@azure/msal-browser';

/**
 * Normalize authority URL so MSAL can resolve .well-known/openid-configuration.
 * - Trim and remove stray spaces (e.g. from .env typos).
 * - Single trailing slash, no double slashes.
 * - For ciamlogin.com (Entra External ID), append /v2.0/ if missing so discovery works.
 */
function normalizeAuthority(raw: string): string {
  let s = raw.trim().replace(/\s+/g, '').replace(/\/*$/, '') || '/';
  if (!s.startsWith('http')) s = `https://${s}`;
  s = s.replace(/([^:]\/)\/+/g, '$1');
  if (!s.endsWith('/')) s += '/';
  try {
    const u = new URL(s);
    if (u.hostname.endsWith('ciamlogin.com') && !u.pathname.includes('v2.0')) {
      s = u.origin + u.pathname.replace(/\/*$/, '') + '/v2.0/';
    }
  } catch {
    // leave as-is
  }
  return s;
}

function getAuthority(): string {
  const externalId =
    import.meta.env.VITE_ENTRA_EXTERNAL_ID_AUTHORITY ||
    import.meta.env.VITE_AZURE_AUTHORITY;
  if (externalId) return normalizeAuthority(externalId);
  const b2c = import.meta.env.VITE_AZURE_B2C_AUTHORITY;
  if (b2c) return normalizeAuthority(b2c);
  const tenant = import.meta.env.VITE_AZURE_B2C_TENANT;
  const policy = import.meta.env.VITE_AZURE_B2C_POLICY || 'B2C_1_signin';
  if (tenant) {
    return `https://${tenant}.b2clogin.com/${tenant}.onmicrosoft.com/${policy}`;
  }
  return '';
}

function getKnownAuthorities(): string[] {
  const externalId =
    import.meta.env.VITE_ENTRA_EXTERNAL_ID_AUTHORITY ||
    import.meta.env.VITE_AZURE_AUTHORITY;
  if (externalId) {
    try {
      const u = new URL(externalId);
      return [u.hostname];
    } catch {
      return [];
    }
  }
  const tenant = import.meta.env.VITE_AZURE_B2C_TENANT;
  if (tenant) return [`${tenant}.b2clogin.com`];
  return [];
}

async function getAuthorityMetadata(): Promise<string | undefined> {
  const metadataRaw = import.meta.env.VITE_ENTRA_AUTHORITY_METADATA;
  const metadataB64 = import.meta.env.VITE_ENTRA_AUTHORITY_METADATA_B64;
  let s = (metadataRaw && typeof metadataRaw === 'string' ? metadataRaw.trim() : '') || (metadataB64 && typeof metadataB64 === 'string' ? metadataB64.trim() : '');
  if (s) {
    try {
      if (s.startsWith('eyJ') && typeof atob !== 'undefined') s = atob(s);
      JSON.parse(s);
      return s;
    } catch {
      // invalid
    }
  }
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    try {
      const r = await fetch('/entra-openid-configuration.json');
      if (r.ok) return await r.text();
    } catch {
      // ignore
    }
  }
  return undefined;
}

function getRedirectUri(): string {
  const envUri = (
    import.meta.env.VITE_ENTRA_REDIRECT_URI ||
    import.meta.env.VITE_AZURE_REDIRECT_URI
  )?.trim();
  const uri = envUri
    ? envUri.replace(/\/+$/, '').replace(/\s+/g, '')
    : typeof window !== 'undefined'
      ? window.location.origin
      : '';
  if (import.meta.env.DEV && uri && typeof window !== 'undefined') {
    console.info(
      '[Azure auth] redirectUri in use (must match Azure App Registration > Authentication > SPA exactly):',
      uri
    );
  }
  return uri;
}

function getAuthConfig(authorityMetadata?: string): Configuration['auth'] {
  const authority = getAuthority();
  const redirectUri = getRedirectUri();
  const auth: Configuration['auth'] = {
    clientId:
      import.meta.env.VITE_ENTRA_CLIENT_ID ||
      import.meta.env.VITE_AZURE_CLIENT_ID ||
      import.meta.env.VITE_AZURE_B2C_CLIENT_ID ||
      '',
    authority,
    knownAuthorities: getKnownAuthorities(),
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  };
  if (authorityMetadata) auth.authorityMetadata = authorityMetadata;
  return auth;
}

const CACHE_OPTIONS: Configuration['cache'] = {
  cacheLocation: 'localStorage',
  storeAuthStateInCookie: false,
};

let initPromise: Promise<PublicClientApplication> | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!initPromise) {
    initPromise = (async () => {
      const authorityMetadata = await getAuthorityMetadata();
      const config: Configuration = {
        auth: getAuthConfig(authorityMetadata),
        cache: CACHE_OPTIONS,
      };
      const instance = new PublicClientApplication(config);
      await instance.initialize();
      return instance;
    })();
  }
  return initPromise;
}

export function getLoginScopes(): string[] {
  const envScopes =
    import.meta.env.VITE_ENTRA_SCOPES ||
    import.meta.env.VITE_AZURE_B2C_SCOPES;
  if (envScopes) return envScopes.split(',').map((s: string) => s.trim()).filter(Boolean);
  return ['openid', 'profile', 'email'];
}

export async function signInWithRedirect(): Promise<void> {
  const authority = getAuthority();
  const clientId =
    import.meta.env.VITE_ENTRA_CLIENT_ID ||
    import.meta.env.VITE_AZURE_CLIENT_ID ||
    import.meta.env.VITE_AZURE_B2C_CLIENT_ID ||
    '';
  if (!clientId || !authority) {
    throw new Error(
      'Azure auth not configured: set VITE_ENTRA_CLIENT_ID (or VITE_AZURE_CLIENT_ID) and VITE_ENTRA_EXTERNAL_ID_AUTHORITY (or VITE_AZURE_AUTHORITY) in .env'
    );
  }
  const discoveryUrl = authority.replace(/\/$/, '') + '/.well-known/openid-configuration';
  try {
    const msal = await getMsalInstance();
    const scopes = getLoginScopes();
    await msal.loginRedirect({
      scopes: scopes as string[],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('endpoints_resolution_error') || msg.includes('Endpoints cannot be resolved')) {
      throw new Error(
        `Endpoints cannot be resolved for authority: ${authority}. ` +
          `Open this URL in your browser; if it doesn't show JSON, the authority format is wrong for your tenant: ${discoveryUrl}. ` +
          `Try in .env: https://<tenant-id>.ciamlogin.com/<tenant-id>/v2.0/ (use your Directory (tenant) ID in both places) or https://<subdomain>.ciamlogin.com/`
      );
    }
    throw err;
  }
}

export async function signInPopup(
  email: string,
  password: string
): Promise<{ account: AccountInfo; result: AuthenticationResult } | { error: Error }> {
  try {
    const msal = await getMsalInstance();
    const scopes = getLoginScopes();
    const result = await msal.loginPopup({
      scopes: scopes as string[],
      loginHint: email,
    });
    return { account: result.account!, result };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function signOut(): Promise<void> {
  const msal = await getMsalInstance();
  const accounts = msal.getAllAccounts();
  if (accounts.length > 0) {
    await msal.logoutRedirect({ account: accounts[0] });
  }
}

export async function getAccount(): Promise<AccountInfo | null> {
  const msal = await getMsalInstance();
  const accounts = msal.getAllAccounts();
  return accounts[0] ?? null;
}

/**
 * Detect whether the configured scopes are purely OIDC/identity scopes.
 * When only OIDC scopes are present (openid, profile, email, offline_access),
 * the MSAL accessToken targets Microsoft Graph, NOT the app itself.
 * In that case we return the idToken instead, whose `aud` = the client ID,
 * which matches what the API's passport-azure-ad BearerStrategy expects.
 *
 * For production, expose an API scope in the App Registration and set
 * VITE_ENTRA_SCOPES=api://<client-id>/access_as_user to get a proper
 * access token with the correct audience.
 */
const OIDC_ONLY_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access']);

function isOidcOnlyScopes(scopes: string[]): boolean {
  return scopes.every((s) => OIDC_ONLY_SCOPES.has(s.trim().toLowerCase()));
}

export async function acquireTokenSilent(): Promise<string | null> {
  const msal = await getMsalInstance();
  const account = await getAccount();
  if (!account) return null;

  const scopes = getLoginScopes();
  const useIdToken = isOidcOnlyScopes(scopes);

  try {
    const result = await msal.acquireTokenSilent({
      scopes: scopes as string[],
      account,
    });
    return useIdToken ? result.idToken : result.accessToken;
  } catch {
    try {
      const result = await msal.acquireTokenPopup({
        scopes: scopes as string[],
      });
      return useIdToken ? result.idToken : result.accessToken;
    } catch {
      return null;
    }
  }
}

export function handleRedirectPromise(): Promise<AuthenticationResult | null> {
  return getMsalInstance().then((msal) => msal.handleRedirectPromise());
}
