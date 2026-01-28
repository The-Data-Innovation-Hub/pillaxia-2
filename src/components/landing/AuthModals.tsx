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
import { Loader2, AlertTriangle } from "lucide-react";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import { useSecurityEvents } from "@/hooks/useSecurityEvents";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [lockoutMessage, setLockoutMessage] = useState<string>("");

  // Signup form state
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [organization, setOrganization] = useState("");

  const { checkAccountLocked, recordLoginAttempt, formatLockoutMessage } = useLoginAttempts();
  const { logSecurityEvent } = useSecurityEvents();

  useEffect(() => {
    setView(defaultView);
    setLockoutMessage("");
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
    setLockoutMessage("");

    try {
      // Check if account is locked before attempting login
      const lockoutStatus = await checkAccountLocked(email);
      if (lockoutStatus.locked) {
        setLockoutMessage(formatLockoutMessage(lockoutStatus));
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Record failed login attempt
        const attemptResult = await recordLoginAttempt(email, false);
        
        if (attemptResult.locked) {
          setLockoutMessage(formatLockoutMessage({
            locked: true,
            minutes_remaining: 30,
          }));
          
          // Log security event for account lockout
          logSecurityEvent({
            eventType: "account_locked",
            category: "authentication",
            severity: "critical",
            description: `Account locked after ${attemptResult.failed_attempts} failed login attempts`,
            metadata: { email, failed_attempts: attemptResult.failed_attempts },
          });
          
          toast.error("Account locked due to too many failed attempts");
        } else if (attemptResult.remaining_attempts !== undefined) {
          const remaining = attemptResult.remaining_attempts;
          if (remaining <= 2) {
            toast.error(`Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`);
          } else {
            toast.error("Invalid email or password");
          }
          
          // Log failed login attempt
          logSecurityEvent({
            eventType: "login_failure",
            category: "authentication",
            severity: remaining <= 2 ? "warning" : "info",
            description: "Failed login attempt",
            metadata: { email, remaining_attempts: remaining },
          });
        } else {
          toast.error(error.message);
        }
      } else {
        // Record successful login
        await recordLoginAttempt(email, true);
        
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
                {lockoutMessage && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{lockoutMessage}</AlertDescription>
                  </Alert>
                )}
                
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
                  disabled={loading || !!lockoutMessage}
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
