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
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Loader2 } from "lucide-react";

interface AuthModalsProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultView?: "login" | "signup";
  onLogin?: (role: "admin" | "pharmacist" | "patient") => void;
}

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const AuthModals = ({
  isOpen = false,
  onOpenChange,
  defaultView = "login",
}: AuthModalsProps) => {
  const navigate = useNavigate();
  const [view, setView] = useState(defaultView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Signup form state
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [organization, setOrganization] = useState("");

  useEffect(() => {
    setView(defaultView);
  }, [defaultView]);

  const validateLogin = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateLogin()) return;
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Welcome back!");
        if (onOpenChange) onOpenChange(false);
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For the waiting list, just show a success message
      // In a real app, this would store the signup in a database
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      toast.success("You've been added to the waiting list!", {
        description: "We'll contact you when it's your turn.",
      });

      if (onOpenChange) onOpenChange(false);
      setName("");
      setSignupEmail("");
      setOrganization("");
    } catch (err) {
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
                ? "Sign in to access your health dashboard"
                : "Join our waiting list to get early access to medication management"}
            </DialogDescription>
          </DialogHeader>

          {view === "login" ? (
            <>
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                {errors.form && (
                  <p className="text-destructive text-sm text-center">{errors.form}</p>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? "border-destructive" : ""}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
                
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-pillaxia-navy-dark"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
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
            </>
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
