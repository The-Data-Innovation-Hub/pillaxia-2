import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface AuthModalsProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultView?: "login" | "signup";
  onLogin?: (role: "admin" | "pharmacist" | "patient") => void;
}

const AuthModals = ({
  isOpen = false,
  onOpenChange,
  defaultView = "login",
}: AuthModalsProps) => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [view, setView] = useState(defaultView);
  const [loading, setLoading] = useState(false);

  // Signup form state (waiting list only)
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [organization, setOrganization] = useState("");

  useEffect(() => {
    setView(defaultView);
  }, [defaultView]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn();
      if (error) {
        toast.error(error.message || "Sign-in failed");
      }
    } catch {
      toast.error("An unexpected error occurred");
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
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoToFullAuth = () => {
    if (onOpenChange) onOpenChange(false);
    navigate("/auth");
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
                ? "Sign in with your Microsoft account"
                : "Join our waiting list to get early access to medication management"}
            </DialogDescription>
          </DialogHeader>

          {view === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-pillaxia-navy-dark"
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

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={handleGoToFullAuth}
                    className="text-primary hover:text-pillaxia-navy-dark font-semibold"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4 mt-4">
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
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  "Join Waiting List"
                )}
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
