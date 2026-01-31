import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { setSentryUser, clearSentryUser, setSentryContext } from "@/lib/sentry";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
// ProfileRow and UserRoleRow inferred from query selects

// Subset of profile fields used in the auth context
interface Profile {
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string, role?: AppRole) => Promise<{ error: Error | null }>;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
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
  };

  // Fetch user roles with proper typing
  const fetchRoles = async (userId: string): Promise<AppRole[]> => {
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
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer data fetching to avoid deadlock
        if (session?.user) {
          setTimeout(async () => {
            const [profileData, rolesData] = await Promise.all([
              fetchProfile(session.user.id),
              fetchRoles(session.user.id),
            ]);
            setProfile(profileData);
            setRoles(rolesData);
            setLoading(false);
            
            // Set Sentry user context with all roles
            setSentryUser({
              id: session.user.id,
              email: session.user.email,
              role: rolesData.includes('admin') ? 'admin' : rolesData[0] || 'patient',
            });
            setSentryContext('user_roles', {
              roles: rolesData,
              isAdmin: rolesData.includes('admin'),
              isManager: rolesData.includes('manager'),
              isClinician: rolesData.includes('clinician'),
              isPharmacist: rolesData.includes('pharmacist'),
            });
            setSentryContext('profile', {
              firstName: profileData?.first_name,
              lastName: profileData?.last_name,
              organization: profileData?.organization,
            });
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
          clearSentryUser();
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
        ]);
        setProfile(profileData);
        setRoles(rolesData);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    role?: AppRole
  ) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role || 'patient',
          },
        },
      });

      if (error) throw error;

      // Update profile with name if provided
      if (data.user && (firstName || lastName)) {
        await supabase
          .from("profiles")
          .update({
            first_name: firstName,
            last_name: lastName,
          })
          .eq("user_id", data.user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearSentryUser();
    toast.success("Signed out successfully");
  };

  const refreshProfile = async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    setProfile(profileData);
  };

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
