import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { setSentryUser, clearSentryUser, setSentryContext } from "@/lib/sentry";
import {
  getStoredNativeTokens,
  clearStoredNativeTokens,
  decodeIdTokenPayload,
  buildWebAuthUrl,
  storePkceVerifier,
} from "@/lib/native-auth";
import { fetchMe, type MeProfile, type AppRole } from "@/lib/azure-api";

/** Minimal user shape for compatibility (id and email from Entra id_token) */
export interface AzureUser {
  id: string;
  email?: string | null;
}

/** Session with Azure access token; session.user.id used as app user identity */
export interface AzureSession {
  access_token: string;
  user: AzureUser;
}

interface AuthContextType {
  user: AzureUser | null;
  session: AzureSession | null;
  profile: MeProfile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email?: string, password?: string) => Promise<{ error: Error | null }>;
  signUp: (email?: string, password?: string, firstName?: string, lastName?: string, role?: AppRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isClinician: boolean;
  isPharmacist: boolean;
  isPatient: boolean;
  isAdminOrManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AzureUser | null>(null);
  const [session, setSession] = useState<AzureSession | null>(null);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessionFromTokens = useCallback(async () => {
    const tokens = getStoredNativeTokens();
    if (!tokens?.access_token) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      setLoading(false);
      clearSentryUser();
      return;
    }

    const payload = tokens.id_token
      ? decodeIdTokenPayload(tokens.id_token)
      : {};
    const userId = payload.oid ?? payload.sub ?? "";
    const email = payload.email ?? null;
    const azureUser: AzureUser = { id: userId, email: email ?? undefined };
    const azureSession: AzureSession = { access_token: tokens.access_token, user: azureUser };
    setUser(azureUser);
    setSession(azureSession);

    const me = await fetchMe(tokens.access_token);
    if (me) {
      setProfile(me.profile ?? null);
      setRoles(me.roles ?? []);
      setSentryUser({
        id: me.user_id,
        email: me.profile?.email ?? email ?? undefined,
        role: me.roles?.includes("admin") ? "admin" : me.roles?.[0] || "patient",
      });
      setSentryContext("user_roles", {
        roles: me.roles ?? [],
        isAdmin: (me.roles ?? []).includes("admin"),
        isManager: (me.roles ?? []).includes("manager"),
        isClinician: (me.roles ?? []).includes("clinician"),
        isPharmacist: (me.roles ?? []).includes("pharmacist"),
      });
      setSentryContext("profile", {
        firstName: me.profile?.first_name,
        lastName: me.profile?.last_name,
        organization: me.profile?.organization,
      });
    } else {
      setProfile(null);
      setRoles([]);
      setSentryUser({ id: userId, email: email ?? undefined });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessionFromTokens();
  }, [loadSessionFromTokens]);

  const signIn = async (_email?: string, _password?: string): Promise<{ error: Error | null }> => {
    try {
      const { url, state, codeVerifier } = await buildWebAuthUrl();
      storePkceVerifier(state, codeVerifier);
      window.location.href = url;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    _email?: string,
    _password?: string,
    _firstName?: string,
    _lastName?: string,
    _role?: AppRole
  ): Promise<{ error: Error | null }> => {
    return signIn();
  };

  const signOut = async () => {
    clearStoredNativeTokens();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    clearSentryUser();
    toast.success("Signed out successfully");
  };

  const refreshProfile = useCallback(async () => {
    const tokens = getStoredNativeTokens();
    if (!tokens?.access_token) return;
    const me = await fetchMe(tokens.access_token);
    if (me) {
      setProfile(me.profile ?? null);
      setRoles(me.roles ?? []);
    }
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);

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
    isAdmin: hasRole("admin"),
    isManager: hasRole("manager"),
    isClinician: hasRole("clinician"),
    isPharmacist: hasRole("pharmacist"),
    isPatient: hasRole("patient"),
    isAdminOrManager: hasRole("admin") || hasRole("manager"),
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
