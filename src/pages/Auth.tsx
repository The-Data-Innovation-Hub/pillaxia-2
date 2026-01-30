import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, User, Stethoscope, Pill, Shield, Home, ShieldCheck, Key, Fingerprint, AlertTriangle, ShieldAlert, Monitor, Building2 } from "lucide-react";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import { useSecurityEvents } from "@/hooks/useSecurityEvents";
import { usePasswordBreachCheck } from "@/hooks/usePasswordBreachCheck";
import { PasswordBreachWarning } from "@/components/shared/PasswordBreachWarning";

type AppRole = "patient" | "clinician" | "pharmacist" | "admin" | "manager";

// Demo mode flag - set VITE_ENABLE_DEMO=true in .env for development/testing
const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO === 'true';

// Demo users for testing (only used when DEMO_MODE_ENABLED is true)
const DEMO_USERS = DEMO_MODE_ENABLED ? [
  { email: "patient@demo.pillaxia.com", password: "DemoPatient2026!", role: "patient" as const, label: "Patient", icon: User, color: "bg-blue-500" },
  { email: "clinician@demo.pillaxia.com", password: "DemoClinician2026!", role: "clinician" as const, label: "Clinician", icon: Stethoscope, color: "bg-green-500" },
  { email: "pharmacist@demo.pillaxia.com", password: "DemoPharmacist2026!", role: "pharmacist" as const, label: "Pharmacist", icon: Pill, color: "bg-purple-500" },
  { email: "manager@demo.pillaxia.com", password: "DemoManager2026!", role: "manager" as const, label: "Manager", icon: Building2, color: "bg-violet-500" },
  { email: "admin@demo.pillaxia.com", password: "DemoAdmin2026!", role: "admin" as const, label: "Admin", icon: Shield, color: "bg-red-500" },
] : [];

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters");

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { isAvailable, isEnabled, biometryName, getCredentials, isLoading: biometricLoading } = useBiometricAuth();
  const { checkAccountLocked, recordLoginAttempt, formatLockoutMessage } = useLoginAttempts();
  const { logSecurityEvent } = useSecurityEvents();
  const { checkPassword, isChecking: isCheckingBreach, breachResult, clearResult: clearBreachResult } = usePasswordBreachCheck();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [biometricAuthLoading, setBiometricAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("patient");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lockoutMessage, setLockoutMessage] = useState<string>("");

  // MFA state
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [checkingDeviceTrust, setCheckingDeviceTrust] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Device trust functions
  const DEVICE_TOKEN_KEY = "pillaxia_device_token";
  
  const getDeviceToken = useCallback((): string => {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      token = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(DEVICE_TOKEN_KEY, token);
    }
    return token;
  }, []);

  const hashToken = async (token: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const checkDeviceTrust = async (userId: string): Promise<boolean> => {
    try {
      const token = getDeviceToken();
      const tokenHash = await hashToken(token);
      
      const { data, error } = await supabase.rpc("is_device_trusted", {
        p_user_id: userId,
        p_device_token_hash: tokenHash,
      });
      
      if (error) {
        console.error("Error checking device trust:", error);
        return false;
      }
      
      return data === true;
    } catch (error) {
      console.error("Error checking device trust:", error);
      return false;
    }
  };

  const trustCurrentDevice = async (userId: string): Promise<boolean> => {
    try {
      const token = getDeviceToken();
      const tokenHash = await hashToken(token);
      
      // Get browser and OS info
      const ua = navigator.userAgent;
      let browser = "Unknown Browser";
      if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Edg")) browser = "Edge";
      else if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari")) browser = "Safari";
      
      let os = "Unknown OS";
      if (ua.includes("Windows")) os = "Windows";
      else if (ua.includes("Mac")) os = "macOS";
      else if (ua.includes("Linux")) os = "Linux";
      else if (ua.includes("Android")) os = "Android";
      else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
      
      const deviceName = `${browser} on ${os}`;
      
      const { error } = await supabase.rpc("trust_device", {
        p_user_id: userId,
        p_device_token_hash: tokenHash,
        p_device_name: deviceName,
        p_browser: browser,
        p_os: os,
        p_ip: null,
        p_days: 30,
      });
      
      if (error) {
        console.error("Error trusting device:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error trusting device:", error);
      return false;
    }
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  // Handle biometric login
  const handleBiometricLogin = async () => {
    setBiometricAuthLoading(true);
    try {
      const credentials = await getCredentials();
      if (credentials) {
        const { error } = await signIn(credentials.username, credentials.password);
        if (error) {
          toast.error("Biometric login failed. Please sign in with your password.");
        } else {
          // Get current user ID for device trust check
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          // Check if MFA is required
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const verifiedFactors = factorsData?.totp?.filter(f => f.status === "verified") || [];
          
          if (verifiedFactors.length > 0 && currentUser) {
            // Check if device is trusted - skip MFA if so
            const isTrusted = await checkDeviceTrust(currentUser.id);
            
            if (isTrusted) {
              // Device is trusted, skip MFA
              toast.success("Welcome back! (Trusted device)");
              navigate("/dashboard");
              return;
            }
            
            // Device not trusted, need MFA
            setPendingUserId(currentUser.id);
            setMfaFactorId(verifiedFactors[0].id);
            setShowMfaChallenge(true);
            return;
          }
          
          toast.success("Welcome back!");
          navigate("/dashboard");
        }
      } else {
        toast.error("Biometric authentication cancelled or failed");
      }
    } catch (error) {
      console.error("Biometric login error:", error);
      toast.error("Biometric login failed");
    } finally {
      setBiometricAuthLoading(false);
    }
  };

  const handleDemoLogin = (demoUser: typeof DEMO_USERS[0]) => {
    setEmail(demoUser.email);
    setPassword(demoUser.password);
    setIsLogin(true);
  };

  const validateForm = () => {
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

    if (!isLogin) {
      try {
        nameSchema.parse(firstName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.firstName = e.errors[0].message;
        }
      }

      try {
        nameSchema.parse(lastName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.lastName = e.errors[0].message;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setLockoutMessage("");

    try {
      if (isLogin) {
        // Check if account is locked before attempting login
        const lockoutStatus = await checkAccountLocked(email);
        if (lockoutStatus.locked) {
          setLockoutMessage(formatLockoutMessage(lockoutStatus));
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
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
          
          // Track login location for security (fire and forget)
          supabase.functions.invoke('get-ip-geolocation', {
            body: { action: 'login' },
          }).catch(err => console.error('Geolocation tracking failed:', err));
          
          // Get current user ID for device trust check
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          
          // Check if MFA is required
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const verifiedFactors = factorsData?.totp?.filter(f => f.status === "verified") || [];
          
          if (verifiedFactors.length > 0 && currentUser) {
            // Check if device is trusted - skip MFA if so
            setCheckingDeviceTrust(true);
            const isTrusted = await checkDeviceTrust(currentUser.id);
            setCheckingDeviceTrust(false);
            
            if (isTrusted) {
              // Device is trusted, skip MFA
              toast.success("Welcome back! (Trusted device)");
              navigate("/dashboard");
              return;
            }
            
            // User has MFA enabled and device is not trusted, need to verify
            setPendingUserId(currentUser.id);
            setMfaFactorId(verifiedFactors[0].id);
            setShowMfaChallenge(true);
            setLoading(false);
            return;
          }
          
          toast.success("Welcome back!");
          navigate("/dashboard");
        }
      } else {
        // For signup, check if password has been breached
        const breachCheck = await checkPassword(password);
        if (breachCheck.breached) {
          toast.error("This password has been found in data breaches. Please choose a different password.");
          setLoading(false);
          return;
        }
        
        const { error } = await signUp(email, password, firstName, lastName, selectedRole);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please sign in instead.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Account created successfully!");
          navigate("/dashboard");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Hash a recovery code for comparison
  const hashRecoveryCode = async (code: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleMfaVerify = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) return;

    setMfaLoading(true);
    try {
      const { data: challengeData, error: challengeError } = 
        await supabase.auth.mfa.challenge({ factorId: mfaFactorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      // Trust device if checkbox was checked
      if (trustDevice && pendingUserId) {
        await trustCurrentDevice(pendingUserId);
        toast.success("Welcome back! Device trusted for 30 days.");
      } else {
        toast.success("Welcome back!");
      }
      navigate("/dashboard");
    } catch (error: any) {
      console.error("MFA verification failed:", error);
      toast.error(error.message || "Invalid verification code. Please try again.");
      setMfaCode("");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRecoveryCodeVerify = async () => {
    const cleanCode = recoveryCode.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (cleanCode.length < 8) {
      toast.error("Please enter a valid recovery code");
      return;
    }

    setMfaLoading(true);
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Hash the entered code
      const codeHash = await hashRecoveryCode(cleanCode);

      // Find matching unused recovery code
      const { data: matchingCode, error: fetchError } = await supabase
        .from("mfa_recovery_codes")
        .select("id, used_at")
        .eq("user_id", currentUser.id)
        .eq("code_hash", codeHash)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!matchingCode) {
        toast.error("Invalid recovery code. Please check and try again.");
        setRecoveryCode("");
        return;
      }

      if (matchingCode.used_at) {
        toast.error("This recovery code has already been used.");
        setRecoveryCode("");
        return;
      }

      // Mark the code as used
      const { error: updateError } = await supabase
        .from("mfa_recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", matchingCode.id);

      if (updateError) throw updateError;

      // Count remaining unused codes
      const { count } = await supabase
        .from("mfa_recovery_codes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUser.id)
        .is("used_at", null);

      setRemainingCodes(count || 0);

      // Send email alert if running low on codes (3 or fewer)
      if (count !== null && count <= 3) {
        toast.warning(`You have ${count} recovery code${count === 1 ? "" : "s"} remaining. Consider generating new codes in your settings.`);
        
        // Send email notification in the background
        supabase.functions.invoke("send-low-recovery-codes-alert", {
          body: {
            email: currentUser.email,
            firstName: currentUser.user_metadata?.first_name,
            remainingCodes: count,
          },
        }).catch((err) => {
          console.error("Failed to send low recovery codes alert email:", err);
        });
      }

      // Trust device if checkbox was checked
      if (trustDevice && currentUser) {
        await trustCurrentDevice(currentUser.id);
        toast.success("Recovery code accepted! Device trusted for 30 days.");
      } else {
        toast.success("Recovery code accepted!");
      }
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Recovery code verification failed:", error);
      toast.error(error.message || "Failed to verify recovery code. Please try again.");
      setRecoveryCode("");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleCancelMfa = () => {
    setShowMfaChallenge(false);
    setMfaFactorId(null);
    setMfaCode("");
    setUseRecoveryCode(false);
    setRecoveryCode("");
    setRemainingCodes(null);
    setTrustDevice(false);
    setPendingUserId(null);
    // Sign out the partially authenticated session
    supabase.auth.signOut();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // MFA Challenge Screen
  if (showMfaChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pillaxia-navy-light/10 via-background to-pillaxia-purple/10 p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-pillaxia-card border-pillaxia-cyan/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
                {useRecoveryCode ? (
                  <Key className="h-8 w-8 text-primary" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-primary" />
                )}
              </div>
              <CardTitle className="text-2xl">
                {useRecoveryCode ? "Use Recovery Code" : "Two-Factor Authentication"}
              </CardTitle>
              <CardDescription>
                {useRecoveryCode 
                  ? "Enter one of your backup recovery codes" 
                  : "Enter the 6-digit code from your authenticator app"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {useRecoveryCode ? (
                <div className="space-y-2">
                  <Label htmlFor="recovery-code">Recovery Code</Label>
                  <Input
                    id="recovery-code"
                    placeholder="e.g., abc12-def34"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="text-center text-lg font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the recovery code exactly as it was provided (with or without dashes)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="mfa-code">Verification Code</Label>
                  <Input
                    id="mfa-code"
                    placeholder="Enter 6-digit code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                  />
                </div>
              )}

              {/* Trust this device checkbox */}
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="trust-device"
                  checked={trustDevice}
                  onCheckedChange={(checked) => setTrustDevice(checked === true)}
                />
                <Label
                  htmlFor="trust-device"
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Trust this device for 30 days
                </Label>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelMfa}
                  className="flex-1"
                  disabled={mfaLoading}
                >
                  Cancel
                </Button>
                {useRecoveryCode ? (
                  <Button
                    onClick={handleRecoveryCodeVerify}
                    disabled={mfaLoading || recoveryCode.replace(/[^a-zA-Z0-9]/g, "").length < 8}
                    className="flex-1"
                  >
                    {mfaLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Verify
                  </Button>
                ) : (
                  <Button
                    onClick={handleMfaVerify}
                    disabled={mfaLoading || mfaCode.length !== 6}
                    className="flex-1"
                  >
                    {mfaLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Verify
                  </Button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setMfaCode("");
                  setRecoveryCode("");
                }}
                className="w-full text-sm"
                disabled={mfaLoading}
              >
                {useRecoveryCode ? (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Use authenticator app instead
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Use a recovery code
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {useRecoveryCode 
                  ? "Recovery codes can only be used once. After using a code, it will be marked as used."
                  : "Open your authenticator app (Google Authenticator, Authy, etc.) to get your code"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pillaxia-navy-light/10 via-background to-pillaxia-purple/10 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Demo Users Section - Only shown when VITE_ENABLE_DEMO=true */}
        {DEMO_MODE_ENABLED && DEMO_USERS.length > 0 && (
          <Card className="shadow-pillaxia-card border-pillaxia-cyan/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Demo Accounts</CardTitle>
              <CardDescription className="text-sm">
                Click to auto-fill credentials, then click Sign In
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                {DEMO_USERS.map((demoUser) => {
                  const Icon = demoUser.icon;
                  return (
                    <button
                      key={demoUser.role}
                      onClick={() => handleDemoLogin(demoUser)}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all hover:scale-105 hover:shadow-md ${
                        email === demoUser.email
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className={`p-1.5 rounded-full ${demoUser.color} text-white`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-sm">{demoUser.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auth Form */}
        <Card className="shadow-pillaxia-card border-pillaxia-cyan/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <h1 className="text-3xl font-bold text-pillaxia-cyan">Pillaxia</h1>
            </div>
            <CardTitle className="text-2xl">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Sign in to access your health dashboard"
                : "Join Pillaxia to manage your medication"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {lockoutMessage && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{lockoutMessage}</AlertDescription>
                </Alert>
              )}
              {!isLogin && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={errors.firstName ? "border-destructive" : ""}
                      />
                      {errors.firstName && (
                        <p className="text-sm text-destructive">{errors.firstName}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={errors.lastName ? "border-destructive" : ""}
                      />
                      {errors.lastName && (
                        <p className="text-sm text-destructive">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">I am a...</Label>
                    <Select value={selectedRole} onValueChange={(value: AppRole) => setSelectedRole(value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="patient">Patient - Managing my medications</SelectItem>
                        <SelectItem value="clinician">Clinician - Healthcare provider</SelectItem>
                        <SelectItem value="pharmacist">Pharmacist - Pharmacy professional</SelectItem>
                        <SelectItem value="manager">Manager - Organization management</SelectItem>
                        <SelectItem value="admin">Administrator - System management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
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
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password || breachResult?.breached ? "border-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
                {!isLogin && breachResult?.breached && (
                  <PasswordBreachWarning count={breachResult.count} className="mt-2" />
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-pillaxia-navy-dark"
                disabled={loading || !!lockoutMessage || isCheckingBreach || (!isLogin && breachResult?.breached)}
              >
                {loading || isCheckingBreach ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isCheckingBreach ? "Checking password security..." : isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : (
                  <>{isLogin ? "Sign In" : "Create Account"}</>
                )}
              </Button>

              {/* Biometric Login Button */}
              {isLogin && isAvailable && isEnabled && !biometricLoading && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBiometricLogin}
                    disabled={biometricAuthLoading}
                    className="w-full"
                  >
                    {biometricAuthLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Fingerprint className="h-4 w-4 mr-2" />
                    )}
                    Sign in with {biometryName}
                  </Button>
                </>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                  }}
                  className="text-primary hover:text-pillaxia-navy-dark font-semibold"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>

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
