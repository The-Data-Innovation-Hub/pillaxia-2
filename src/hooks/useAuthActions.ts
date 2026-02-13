/**
 * Hook for authentication actions (sign in, sign up, sign out).
 * Delegates to AuthContext (Azure/Entra).
 */
import { useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/lib/azure-api";

interface SignInResult {
  error: Error | null;
}

interface SignUpResult {
  error: Error | null;
}

/**
 * Custom hook providing authentication action methods.
 * Sign-in/sign-up redirect to Microsoft; sign-out clears Azure session.
 */
export function useAuthActions() {
  const { signIn: authSignIn, signUp: authSignUp, signOut: authSignOut } = useAuth();

  const signIn = async (_email: string, _password: string): Promise<SignInResult> => {
    return authSignIn();
  };

  const signUp = async (
    _email: string,
    _password: string,
    _firstName?: string,
    _lastName?: string,
    _role?: AppRole
  ): Promise<SignUpResult> => {
    return authSignUp();
  };

  return {
    signIn,
    signUp,
    signOut: authSignOut,
  };
}
