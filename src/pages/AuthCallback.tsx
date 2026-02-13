import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  getCodeAndStateFromUrl,
  takePkceVerifier,
  exchangeCodeForTokens,
  setStoredNativeTokens,
  getWebRedirectUri,
} from "@/lib/native-auth";

/**
 * OAuth callback for Azure (Entra) sign-in.
 * Handles ?code=...&state=... from redirect, exchanges code for tokens, stores them, redirects to dashboard.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const code = searchParams.get("code") ?? undefined;
      const state = searchParams.get("state") ?? undefined;
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      if (!code || !state) {
        setError("Missing code or state from login provider.");
        return;
      }

      const codeVerifier = takePkceVerifier(state);
      if (!codeVerifier) {
        setError("Invalid or expired state. Please try signing in again.");
        return;
      }

      try {
        const redirectUri = getWebRedirectUri();
        if (!redirectUri) {
          setError("Redirect URI not configured.");
          return;
        }
        const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
        if (cancelled) return;
        setStoredNativeTokens(tokens);
        navigate("/dashboard", { replace: true });
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Sign-in failed.";
        setError(message);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-destructive mb-4 text-center">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/auth", { replace: true })}
          className="text-primary hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Signing you in..." />
    </div>
  );
};

export default AuthCallback;
