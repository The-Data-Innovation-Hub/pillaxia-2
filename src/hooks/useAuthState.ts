/**
 * Hook for auth state (user, session, profile, roles).
 * Delegates to AuthContext (Azure/Entra); kept for compatibility with existing callers.
 */
import { useAuth } from "@/contexts/AuthContext";
import type { MeProfile } from "@/lib/azure-api";
import type { AzureUser, AzureSession } from "@/contexts/AuthContext";

export type AppRole = "patient" | "clinician" | "pharmacist" | "admin" | "manager";

export interface Profile {
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

export function useAuthState(): {
  user: AzureUser | null;
  session: AzureSession | null;
  profile: MeProfile | null;
  roles: AppRole[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
} {
  const { user, session, profile, roles, loading, refreshProfile } = useAuth();
  return {
    user,
    session,
    profile: profile as Profile | null,
    roles,
    loading,
    refreshProfile,
  };
}
