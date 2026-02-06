/**
 * Unified Auth Context - MSAL / Azure Entra ID based
 * MSAL-based authentication provider for Azure AD B2C.
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  getAccount,
  signInWithRedirect,
  signOut as msalSignOut,
  acquireTokenSilent,
  handleRedirectPromise,
} from "@/lib/azure-auth";
import { apiClient } from "@/integrations/api/client";
import { toast } from "sonner";
import { setSentryUser, clearSentryUser, setSentryContext } from "@/lib/sentry";
import type { Database } from "@/types/database";

export type AppRole = Database["public"]["Enums"]["app_role"];

// Minimal user shape
export interface AppUser {
  id: string;
  email: string | null;
}

export interface AppSession {
  user: AppUser;
  access_token: string;
}

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  organization_id: string | null;
  language_preference: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: AppSession | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email?: string, password?: string) => Promise<{ error: Error | null }>;
  signUp: (
    email?: string,
    password?: string,
    firstName?: string,
    lastName?: string,
    role?: AppRole
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isAdmin: boolean;
  isManager: boolean;
  isClinician: boolean;
  isPharmacist: boolean;
  isPatient: boolean;
  isAdminOrManager: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --------------- data helpers ---------------

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await apiClient
    .from("profiles")
    .select(
      "id, user_id, first_name, last_name, phone, organization_id, language_preference, avatar_url"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  return data as Profile | null;
}

async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await apiClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(100);
  if (error) {
    console.error("Error fetching roles:", error);
    return [];
  }
  return (data || []).map((r: { role: AppRole }) => r.role);
}

// --------------- provider ---------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(
    async (account: { localAccountId: string; username?: string }) => {
      const userId = account.localAccountId;
      const [profileData, rolesData] = await Promise.all([
        fetchProfile(userId),
        fetchRoles(userId),
      ]);

      setProfile(profileData);
      setRoles(rolesData);

      const appUser: AppUser = { id: userId, email: account.username ?? null };
      setUser(appUser);

      const token = (await acquireTokenSilent()) ?? "";
      setSession({ user: appUser, access_token: token });

      setSentryUser({
        id: userId,
        email: account.username ?? undefined,
        role: rolesData.includes("admin") ? "admin" : rolesData[0] || "patient",
      });
      setSentryContext("user_roles", {
        roles: rolesData,
        isAdmin: rolesData.includes("admin"),
        isManager: rolesData.includes("manager"),
        isClinician: rolesData.includes("clinician"),
        isPharmacist: rolesData.includes("pharmacist"),
      });
      if (profileData) {
        setSentryContext("profile", {
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          organizationId: profileData.organization_id,
        });
      }

      // Notify LanguageProvider (avoids circular context dependency)
      (window as any).__pillaxia_userId = userId;
      window.dispatchEvent(
        new CustomEvent("pillaxia:auth-change", { detail: { userId } })
      );
    },
    []
  );

  // Bootstrap: handle redirect or pick existing MSAL account
  useEffect(() => {
    handleRedirectPromise()
      .then(async (result) => {
        const account = result?.account ?? (await getAccount());
        if (account) {
          try {
            await loadUserData(account);
          } catch (err) {
            console.error("loadUserData error:", err);
            toast.error("Could not load profile. You are signed in.");
            const fallbackUser: AppUser = {
              id: account.localAccountId,
              email: account.username ?? null,
            };
            setUser(fallbackUser);
            setSession({ user: fallbackUser, access_token: "" });
          }
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
          setRoles([]);
          clearSentryUser();
        }
      })
      .catch((err) => {
        console.error("handleRedirectPromise error:", err);
        // Don't toast on user-cancelled redirects
        if (!String(err?.message).includes("user_cancelled")) {
          toast.error(err?.message || "Sign-in failed");
        }
      })
      .finally(() => setLoading(false));
  }, [loadUserData]);

  // Proactive token refresh — refresh every 45 min (tokens typically expire at 60 min)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const token = await acquireTokenSilent();
        if (token && session) {
          setSession((prev) =>
            prev ? { ...prev, access_token: token } : prev
          );
        }
      } catch {
        console.warn("Proactive token refresh failed");
      }
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, session]);

  // Listen for auth-expired events dispatched by the API client
  useEffect(() => {
    const handler = async () => {
      console.warn("Auth expired event received — signing out");
      toast.error("Your session has expired. Please sign in again.");
      await msalSignOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      clearSentryUser();
    };
    window.addEventListener("pillaxia:auth-expired", handler);
    return () => window.removeEventListener("pillaxia:auth-expired", handler);
  }, []);

  // ---- actions ----

  const signIn = useCallback(
    async (_email?: string, _password?: string) => {
      try {
        await signInWithRedirect();
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || "Sign in failed");
        return { error: err instanceof Error ? err : new Error(message) };
      }
    },
    []
  );

  const signUp = useCallback(
    async (
      _email?: string,
      _password?: string,
      _firstName?: string,
      _lastName?: string,
      _role?: AppRole
    ) => {
      try {
        toast.info(
          'Redirecting to sign-in — choose "Sign up" or "Create account" on the next page'
        );
        await signInWithRedirect();
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || "Redirect failed");
        return { error: err instanceof Error ? err : new Error(message) };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await msalSignOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    clearSentryUser();
    (window as any).__pillaxia_userId = null;
    window.dispatchEvent(
      new CustomEvent("pillaxia:auth-change", { detail: { userId: null } })
    );
  }, []);

  const refreshProfile = useCallback(async () => {
    const account = await getAccount();
    if (account) {
      await loadUserData(account);
    }
  }, [loadUserData]);

  const getToken = useCallback(async (): Promise<string | null> => {
    return acquireTokenSilent();
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    roles,
    loading,
    signIn,
    signUp,
    signOut,
    hasRole,
    refreshProfile,
    getToken,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("manager"),
    isClinician: roles.includes("clinician"),
    isPharmacist: roles.includes("pharmacist"),
    isPatient: roles.includes("patient"),
    isAdminOrManager: roles.includes("admin") || roles.includes("manager"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
