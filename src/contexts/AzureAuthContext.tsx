/**
 * Azure AD B2C Auth Context
 * Use when VITE_USE_AZURE_AUTH=true
 * Replaces Supabase auth with MSAL + API client
 * Uses same AuthContext as AuthContext.tsx for useAuth compatibility
 */

import { useEffect, useState, ReactNode } from 'react';
import {
  getAccount,
  signInWithRedirect,
  signOut as msalSignOut,
  acquireTokenSilent,
  handleRedirectPromise,
} from '@/lib/azure-auth';
import { apiClient } from '@/integrations/api/client';
import { toast } from 'sonner';
import { setSentryUser, clearSentryUser, setSentryContext } from '@/lib/sentry';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

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

// User shape compatible with Supabase User
interface AzureUser {
  id: string;
  email: string | null;
}

interface Session {
  user: AzureUser;
  access_token: string;
}

interface AuthContextType {
  user: AzureUser | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    role?: AppRole
  ) => Promise<{ error: Error | null }>;
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

import { AuthContext } from './AuthContext';

export function AzureAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AzureUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await apiClient
      .from('profiles')
      .select('id, user_id, first_name, last_name, email, phone, organization, language_preference, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
    return data;
  };

  const fetchRoles = async (userId: string): Promise<AppRole[]> => {
    const { data, error } = await apiClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(100);
    if (error) return [];
    return (data || []).map((r: { role: AppRole }) => r.role);
  };

  const loadUserData = async (account: { localAccountId: string; username?: string }) => {
    const userId = account.localAccountId;
    const [profileData, rolesData] = await Promise.all([
      fetchProfile(userId),
      fetchRoles(userId),
    ]);
    setProfile(profileData);
    setRoles(rolesData);
    setUser({
      id: userId,
      email: account.username ?? null,
    });
    setSession({
      user: { id: userId, email: account.username ?? null },
      access_token: (await acquireTokenSilent()) ?? '',
    });
    setSentryUser({
      id: userId,
      email: account.username ?? undefined,
      role: rolesData.includes('admin') ? 'admin' : rolesData[0] || 'patient',
    });
    setSentryContext('user_roles', {
      roles: rolesData,
      isAdmin: rolesData.includes('admin'),
      isManager: rolesData.includes('manager'),
      isClinician: rolesData.includes('clinician'),
      isPharmacist: rolesData.includes('pharmacist'),
    });
  };

  useEffect(() => {
    handleRedirectPromise()
      .then(async (result) => {
        if (result?.account) {
          try {
            await loadUserData(result.account);
          } catch (err) {
            console.error('loadUserData error:', err);
            toast.error('Could not load profile. You are signed in.');
            setUser({ id: result.account.localAccountId, email: result.account.username ?? null });
            setSession({
              user: { id: result.account.localAccountId, email: result.account.username ?? null },
              access_token: '',
            });
          }
        } else {
          const account = await getAccount();
          if (account) {
            try {
              await loadUserData(account);
            } catch (err) {
              console.error('loadUserData error:', err);
              setUser({ id: account.localAccountId, email: account.username ?? null });
              setSession({ user: { id: account.localAccountId, email: account.username ?? null }, access_token: '' });
            }
          } else {
            setUser(null);
            setSession(null);
            setProfile(null);
            setRoles([]);
            clearSentryUser();
          }
        }
      })
      .catch((err) => {
        console.error('handleRedirectPromise error:', err);
        toast.error(err?.message || 'Sign-in failed');
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (_email: string, _password: string) => {
    try {
      await signInWithRedirect();
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || 'Sign in failed');
      return { error: err instanceof Error ? err : new Error(message) };
    }
  };

  const signUp = async (
    _email: string,
    _password: string,
    _firstName?: string,
    _lastName?: string,
    _role?: AppRole
  ) => {
    try {
      toast.info('Redirecting to sign-in — choose "Sign up" or "Create account" on the next page');
      await signInWithRedirect();
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || 'Redirect failed');
      return { error: err instanceof Error ? err : new Error(message) };
    }
  };

  const signOut = async () => {
    await msalSignOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    clearSentryUser();
  };

  const refreshProfile = async () => {
    const account = await getAccount();
    if (account) {
      await loadUserData(account);
    }
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
    isAdmin: roles.includes('admin'),
    isManager: roles.includes('manager'),
    isClinician: roles.includes('clinician'),
    isPharmacist: roles.includes('pharmacist'),
    isPatient: roles.includes('patient'),
    isAdminOrManager: roles.includes('admin') || roles.includes('manager'),
  };

  return (
    <AuthContext.Provider value={value as never}>{children}</AuthContext.Provider>
  );
}
