/**
 * Hook for reading authentication state.
 * Thin wrapper around the unified AuthContext.
 * Kept for backwards compatibility with existing imports.
 */
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole, Profile, AppUser, AppSession } from "@/contexts/AuthContext";

export type { AppRole, Profile };

export function useAuthState() {
  const auth = useAuth();

  return {
    user: auth.user as AppUser | null,
    session: auth.session as AppSession | null,
    profile: auth.profile,
    roles: auth.roles,
    loading: auth.loading,
    refreshProfile: auth.refreshProfile,
  };
}
