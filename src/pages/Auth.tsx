import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Home } from "lucide-react";

/**
 * Auth page — Azure / MSAL redirect-based sign-in.
 * Email/password forms, MFA, biometric are no longer needed
 * because Azure AD B2C handles all of that in its hosted flow.
 */
const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Already signed in
  if (user) {
    navigate("/dashboard", { replace: true });
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
              Sign in or create an account with Microsoft to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              size="lg"
              className="w-full bg-primary hover:bg-pillaxia-navy-dark text-primary-foreground"
              disabled={redirecting}
              onClick={async () => {
                setRedirecting(true);
                try {
                  await signIn();
                } finally {
                  setRedirecting(false);
                }
              }}
            >
              {redirecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting…
                </>
              ) : (
                "Sign in with Microsoft"
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              className="w-full border-pillaxia-cyan/50 text-muted-foreground hover:text-foreground hover:border-pillaxia-cyan"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
