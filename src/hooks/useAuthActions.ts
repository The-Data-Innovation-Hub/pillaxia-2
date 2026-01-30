/**
 * Hook for authentication actions (sign in, sign up, sign out).
 * Extracted from AuthContext for better separation of concerns.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearSentryUser } from "@/lib/sentry";
import type { AppRole } from "./useAuthState";

interface SignInResult {
  error: Error | null;
}

interface SignUpResult {
  error: Error | null;
}

/**
 * Custom hook providing authentication action methods.
 */
export function useAuthActions() {
  /**
   * Signs in a user with email and password.
   */
  const signIn = async (email: string, password: string): Promise<SignInResult> => {
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

  /**
   * Signs up a new user with email, password, and optional profile data.
   */
  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    role?: AppRole
  ): Promise<SignUpResult> => {
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
            role: role || "patient",
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

  /**
   * Signs out the current user.
   */
  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    clearSentryUser();
    toast.success("Signed out successfully");
  };

  return {
    signIn,
    signUp,
    signOut,
  };
}
