/**
 * Hook for managing authentication state (user, session, profile, roles).
 * Extracted from AuthContext for better separation of concerns.
 */
import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setSentryUser, clearSentryUser, setSentryContext } from "@/lib/sentry";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

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

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
}

/**
 * Fetches user profile from the database.
 */
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, first_name, last_name, email, phone, organization, language_preference, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
  return data;
}

/**
 * Fetches user roles from the database.
 */
async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching roles:", error);
    return [];
  }
  // data is properly typed as Pick<UserRoleRow, "role">[]
  return data.map((r) => r.role);
}

/**
 * Sets Sentry user context for error tracking.
 */
function updateSentryContext(
  user: User,
  profile: Profile | null,
  roles: AppRole[]
): void {
  setSentryUser({
    id: user.id,
    email: user.email,
    role: roles.includes("admin") ? "admin" : roles[0] || "patient",
  });
  setSentryContext("user_roles", {
    roles,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("manager"),
    isClinician: roles.includes("clinician"),
    isPharmacist: roles.includes("pharmacist"),
  });
  setSentryContext("profile", {
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    organization: profile?.organization,
  });
}

/**
 * Custom hook for managing authentication state.
 * Handles auth state changes, profile/role fetching, and Sentry integration.
 */
export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    roles: [],
    loading: true,
  });

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    const profileData = await fetchProfile(state.user.id);
    setState((prev) => ({ ...prev, profile: profileData }));
  }, [state.user]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      // Defer data fetching to avoid deadlock
      if (session?.user) {
        setTimeout(async () => {
          const [profileData, rolesData] = await Promise.all([
            fetchProfile(session.user.id),
            fetchRoles(session.user.id),
          ]);

          setState((prev) => ({
            ...prev,
            profile: profileData,
            roles: rolesData,
            loading: false,
          }));

          updateSentryContext(session.user, profileData, rolesData);
        }, 0);
      } else {
        setState((prev) => ({
          ...prev,
          profile: null,
          roles: [],
          loading: false,
        }));
        clearSentryUser();
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
        ]);
        setState((prev) => ({
          ...prev,
          profile: profileData,
          roles: rolesData,
          loading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    ...state,
    refreshProfile,
  };
}
