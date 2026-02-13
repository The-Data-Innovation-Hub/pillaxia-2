import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Home } from "lucide-react";

const hasEntraConfig = (): boolean => {
  const clientId = (import.meta.env.VITE_ENTRA_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID || "").trim();
  const authority = (import.meta.env.VITE_ENTRA_EXTERNAL_ID_AUTHORITY || import.meta.env.VITE_AZURE_AUTHORITY || "").trim();
  const functionsUrl = (import.meta.env.VITE_AZURE_FUNCTIONS_URL || "").trim();
  return !!clientId && !!authority && !!functionsUrl;
};

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entraConfigured = hasEntraConfig();

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await signIn();
      if (err) {
        setError(err.message);
        setLoading(false);
      }
      // On success, signIn redirects to Entra; no need to navigate
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pillaxia-navy-light/10 via-background to-pillaxia-purple/10 p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-pillaxia-card border-pillaxia-cyan/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <h1 className="text-3xl font-bold text-pillaxia-cyan">Pillaxia</h1>
            </div>
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>
              Sign in with your Microsoft account to access your health dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!entraConfigured && (
              <p className="text-sm text-muted-foreground text-center rounded-md bg-muted/50 p-3">
                Sign-in works on the deployed app because env vars are set in the pipeline. Locally, add <code className="text-xs bg-muted px-1 rounded">VITE_ENTRA_CLIENT_ID</code>, <code className="text-xs bg-muted px-1 rounded">VITE_ENTRA_EXTERNAL_ID_AUTHORITY</code>, and <code className="text-xs bg-muted px-1 rounded">VITE_AZURE_FUNCTIONS_URL</code> to your <code className="text-xs bg-muted px-1 rounded">.env</code> (see README).
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="button"
              onClick={handleSignIn}
              className="w-full bg-primary hover:bg-pillaxia-navy-dark"
              disabled={loading || !entraConfigured}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                "Sign in with Microsoft"
              )}
            </Button>

            <div className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full border-pillaxia-cyan/50 text-muted-foreground hover:text-foreground hover:border-pillaxia-cyan"
              >
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
