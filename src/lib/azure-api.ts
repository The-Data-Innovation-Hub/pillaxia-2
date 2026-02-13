/**
 * Azure backend API helpers.
 * Assumes VITE_AZURE_FUNCTIONS_URL is set and backend accepts Bearer token (Entra access token).
 */

const getBase = (): string => {
  const raw = (import.meta.env.VITE_AZURE_FUNCTIONS_URL || "").trim().replace(/\/+$/, "");
  return raw;
};

export interface MeProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  language_preference: string | null;
  avatar_url: string | null;
}

export type AppRole = "patient" | "clinician" | "pharmacist" | "admin" | "manager";

export interface MeResponse {
  user_id: string;
  profile: MeProfile | null;
  roles: AppRole[];
}

/**
 * Fetch current user profile and roles from the backend using the Azure access token.
 * Backend must validate the token and return the mapped user's profile and roles.
 */
export async function fetchMe(accessToken: string): Promise<MeResponse | null> {
  const base = getBase();
  if (!base) {
    console.warn("VITE_AZURE_FUNCTIONS_URL is not set; cannot fetch /api/me");
    return null;
  }
  const url = `${base}/api/me`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401) return null;
    console.error("GET /api/me failed:", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as MeResponse;
  return data;
}
