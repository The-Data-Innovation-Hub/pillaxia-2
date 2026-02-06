/**
 * Hook for authentication actions (sign in, sign up, sign out).
 * Thin wrapper around the unified AuthContext.
 * Kept for backwards compatibility with existing imports.
 */
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/contexts/AuthContext";

export type { AppRole };

interface SignInResult {
  error: Error | null;
}

interface SignUpResult {
  error: Error | null;
}

export function useAuthActions() {
  const { signIn, signUp, signOut } = useAuth();

  return {
    signIn: signIn as (email: string, password: string) => Promise<SignInResult>,
    signUp: signUp as (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
      role?: AppRole
    ) => Promise<SignUpResult>,
    signOut,
  };
}
