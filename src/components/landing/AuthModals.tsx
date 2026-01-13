import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface AuthModalsProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultView?: "login" | "signup";
  onLogin?: (role: "admin" | "pharmacist" | "patient") => void;
}

const demoCredentials = [
  { role: "Admin", email: "sarah@pillaxia.com", password: "demo123" },
  { role: "Pharmacist", email: "michael@citymed.com", password: "demo123" },
  { role: "Patient", email: "john@example.com", password: "demo123" },
];

const AuthModals = ({
  isOpen = false,
  onOpenChange,
  defaultView = "login",
  onLogin,
}: AuthModalsProps) => {
  const [view, setView] = useState(defaultView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Signup form state
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [organization, setOrganization] = useState("");

  useEffect(() => {
    setView(defaultView);
  }, [defaultView]);

  const fillCredentials = (userEmail: string, userPassword: string) => {
    setEmail(userEmail);
    setPassword(userPassword);
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Simulate login delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Map email to role
      let role: "admin" | "pharmacist" | "patient" = "patient";
      if (email === "sarah@pillaxia.com") {
        role = "admin";
      } else if (email === "michael@citymed.com") {
        role = "pharmacist";
      }

      toast.success(`Welcome back!`, {
        description: `Logged in as ${role}`,
      });

      if (onOpenChange) onOpenChange(false);
      if (onLogin) onLogin(role);
    } catch (err) {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      toast.success("You've been added to the waiting list!", {
        description: "We'll contact you when it's your turn.",
      });

      if (onOpenChange) onOpenChange(false);
      setName("");
      setSignupEmail("");
      setOrganization("");
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background">
        <Card className="p-6 shadow-pillaxia-card border-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-pillaxia-navy-dark">
              {view === "login" ? "Welcome Back" : "Join Waiting List"}
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              {view === "login"
                ? "Click on a credential card below to auto-fill the login form"
                : "Join our waiting list to get early access to medication management"}
            </DialogDescription>
          </DialogHeader>

          {view === "login" ? (
            <>
              <div className="mb-4 space-y-2">
                {demoCredentials.map((cred) => (
                  <div
                    key={cred.email}
                    onClick={() => fillCredentials(cred.email, cred.password)}
                    className="p-3 bg-muted/50 rounded-lg border border-primary/10 cursor-pointer hover:bg-muted hover:border-primary/20 transition-colors"
                  >
                    <div className="text-sm font-medium text-primary">{cred.role}:</div>
                    <div className="text-sm text-muted-foreground">Email: {cred.email}</div>
                    <div className="text-sm text-muted-foreground">Password: {cred.password}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && <p className="text-destructive text-sm text-center">{error}</p>}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-pillaxia-navy-dark"
                >
                  {loading ? "Logging in..." : "Log In"}
                </Button>
                
                <p className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setView("signup")}
                    className="text-primary hover:text-pillaxia-navy-dark font-semibold"
                  >
                    Sign up
                  </button>
                </p>
              </form>
            </>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              {error && <p className="text-destructive text-sm text-center">{error}</p>}
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="organization">Organization (Optional)</Label>
                <Input
                  id="organization"
                  placeholder="Enter your pharmacy or organization name"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-pillaxia-navy-dark"
              >
                {loading ? "Signing up..." : "Join Waiting List"}
              </Button>
              
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="text-primary hover:text-pillaxia-navy-dark font-semibold"
                >
                  Log in
                </button>
              </p>
            </form>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModals;
