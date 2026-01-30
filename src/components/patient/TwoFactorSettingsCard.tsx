import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  QrCode,
  Copy,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  Phone,
  Download,
  Key,
  RefreshCw,
} from "lucide-react";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  phone?: string;
}

type MFAMethod = "totp" | "phone";

const generateRecoveryCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 10; i++) {
    if (i === 5) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const hashCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

export function TwoFactorSettingsCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showMethodSelect, setShowMethodSelect] = useState(false);
  const [showRecoveryCodesDialog, setShowRecoveryCodesDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [suspendRecoveryCode, setSuspendRecoveryCode] = useState("");
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod>("totp");
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneEnrollStep, setPhoneEnrollStep] = useState<"input" | "verify">("input");

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [hasRecoveryCodes, setHasRecoveryCodes] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  const fetchFactors = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const allFactors: MFAFactor[] = [
        ...(data.totp || []),
        ...(data.phone || []),
      ];
      setFactors(allFactors);

      const { count } = await supabase
        .from("mfa_recovery_codes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("used_at", null);
      
      setHasRecoveryCodes((count || 0) > 0);
    } catch (error) {
      console.error("Error fetching MFA factors:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFactors();
  }, [user]);

  const enabledFactors = factors.filter((f) => f.status === "verified");
  const hasEnabledFactor = enabledFactors.length > 0;

  const generateAndStoreRecoveryCodes = async (): Promise<string[]> => {
    if (!user) return [];

    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(generateRecoveryCode());
    }

    await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);

    const hashedCodes = await Promise.all(
      codes.map(async (code) => ({
        user_id: user.id,
        code_hash: await hashCode(code.replace("-", "")),
      }))
    );

    const { error } = await supabase.from("mfa_recovery_codes").insert(hashedCodes);

    if (error) {
      console.error("Error storing recovery codes:", error);
      throw error;
    }

    return codes;
  };

  const handleSelectMethod = (method: MFAMethod) => {
    setSelectedMethod(method);
    setShowMethodSelect(false);
    if (method === "totp") {
      handleStartTotpEnroll();
    } else {
      setPhoneEnrollStep("input");
      setPhoneNumber("");
      setShowEnrollDialog(true);
    }
  };

  const handleStartTotpEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pillaxia Authenticator",
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setShowEnrollDialog(true);
    } catch (error) {
      console.error("Error enrolling MFA:", error);
      toast({
        title: "Failed to set up 2FA",
        description: error.message || "Could not start enrollment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartPhoneEnroll = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter a valid phone number with country code.",
        variant: "destructive",
      });
      return;
    }

    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "phone",
        friendlyName: "Pillaxia SMS",
        phone: phoneNumber.trim(),
      });

      if (error) throw error;

      setFactorId(data.id);
      
      const { error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: data.id,
      });

      if (challengeError) throw challengeError;

      setPhoneEnrollStep("verify");
      toast({
        title: "Code sent",
        description: `A verification code has been sent to ${phoneNumber}`,
      });
    } catch (error: unknown) {
      console.error("Error enrolling phone MFA:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Failed to set up SMS 2FA",
        description: message || "Could not send verification code. Please check your phone number.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!factorId || verificationCode.length !== 6) return;

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = 
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      const codes = await generateAndStoreRecoveryCodes();
      setRecoveryCodes(codes);

      toast({
        title: "Two-factor authentication enabled",
        description: `Your account is now protected with ${selectedMethod === "totp" ? "authenticator app" : "SMS"} 2FA.`,
      });

      resetEnrollState();
      setShowRecoveryCodesDialog(true);
      fetchFactors();
    } catch (error: unknown) {
      console.error("Error verifying MFA:", error);
      toast({
        title: "Verification failed",
        description: error instanceof Error && error.message ? error.message : "Invalid code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendSmsCode = async () => {
    if (!factorId) return;
    
    setEnrolling(true);
    try {
      const { error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) throw error;
      
      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your phone.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: "Failed to resend code",
        description: errorMessage || "Could not resend verification code.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleDisable2FA = async (factor: MFAFactor) => {
    setDisabling(true);
    try {
      const { data: challengeData, error: challengeError } = 
        await supabase.auth.mfa.challenge({ factorId: factor.id });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: disableCode,
      });

      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });

      if (unenrollError) throw unenrollError;

      const { data: remainingFactors } = await supabase.auth.mfa.listFactors();
      const verified = [
        ...(remainingFactors?.totp?.filter(f => f.status === "verified" && f.id !== factor.id) || []),
        ...(remainingFactors?.phone?.filter(f => f.status === "verified" && f.id !== factor.id) || []),
      ];

      if (verified.length === 0 && user) {
        await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
      }

      toast({
        title: "Two-factor authentication disabled",
        description: `${factor.factor_type === "totp" ? "Authenticator app" : "SMS"} 2FA has been removed.`,
      });

      setShowDisableDialog(false);
      setDisableCode("");
      setFactorId(null);
      fetchFactors();
    } catch (error: unknown) {
      console.error("Error disabling MFA:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Failed to disable 2FA",
        description: message || "Invalid code or error occurred.",
        variant: "destructive",
      });
    } finally {
      setDisabling(false);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!user || regenerateCode.length !== 6) return;

    setRegenerating(true);
    try {
      const factor = enabledFactors[0];
      if (!factor) throw new Error("No 2FA factor found");

      const { data: challengeData, error: challengeError } = 
        await supabase.auth.mfa.challenge({ factorId: factor.id });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code: regenerateCode,
      });

      if (verifyError) throw verifyError;

      const codes = await generateAndStoreRecoveryCodes();
      setRecoveryCodes(codes);

      toast({
        title: "Recovery codes regenerated",
        description: "Your old recovery codes are no longer valid.",
      });

      setShowRegenerateDialog(false);
      setRegenerateCode("");
      setShowRecoveryCodesDialog(true);
      fetchFactors();
    } catch (error: unknown) {
      console.error("Error regenerating recovery codes:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast({
        title: "Failed to regenerate codes",
        description: message || "Invalid verification code.",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  // Suspend 2FA using a recovery code (for users who lost their authenticator)
  const handleSuspend2FA = async () => {
    if (!user || !suspendRecoveryCode.trim()) return;

    setSuspending(true);
    try {
      // Normalize the recovery code (remove dashes and uppercase)
      const normalizedCode = suspendRecoveryCode.replace(/-/g, "").toUpperCase();
      const codeHash = await hashCode(normalizedCode);

      // Verify the recovery code exists and is unused
      const { data: recoveryCodeRecord, error: fetchError } = await supabase
        .from("mfa_recovery_codes")
        .select("id")
        .eq("user_id", user.id)
        .eq("code_hash", codeHash)
        .is("used_at", null)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!recoveryCodeRecord) {
        throw new Error("Invalid or already used recovery code");
      }

      // Mark the recovery code as used
      await supabase
        .from("mfa_recovery_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", recoveryCodeRecord.id);

      // Unenroll all MFA factors
      for (const factor of enabledFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (unenrollError) {
          console.error("Error unenrolling factor:", unenrollError);
        }
      }

      // Delete remaining recovery codes
      await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);

      toast({
        title: "Two-factor authentication suspended",
        description: "2FA has been disabled. You can re-enable it anytime.",
      });

      setShowSuspendDialog(false);
      setSuspendRecoveryCode("");
      fetchFactors();
    } catch (error: unknown) {
      console.error("Error suspending MFA:", error);
      toast({
        title: "Failed to suspend 2FA",
        description: error.message || "Invalid recovery code or error occurred.",
        variant: "destructive",
      });
    } finally {
      setSuspending(false);
    }
  };

  const downloadRecoveryCodes = () => {
    const content = [
      "Pillaxia 2FA Recovery Codes",
      "===========================",
      "",
      "Keep these codes in a safe place. Each code can only be used once.",
      "",
      ...recoveryCodes.map((code, i) => `${i + 1}. ${code}`),
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pillaxia-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Recovery codes downloaded",
      description: "Store them safely - they can only be used once each.",
    });
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const resetEnrollState = () => {
    setShowEnrollDialog(false);
    setVerificationCode("");
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setPhoneNumber("");
    setPhoneEnrollStep("input");
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security using an authenticator app or SMS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasEnabledFactor ? (
            <>
              <Alert className="border-primary/50 bg-primary/10">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  Two-factor authentication is enabled on your account.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {enabledFactors.map((factor) => (
                  <div key={factor.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {factor.factor_type === "totp" ? (
                        <QrCode className="h-4 w-4 text-primary" />
                      ) : (
                        <Smartphone className="h-4 w-4 text-primary" />
                      )}
                      <div>
                        <Label className="font-medium">
                          {factor.factor_type === "totp" ? "Authenticator App" : "SMS"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {factor.factor_type === "totp" 
                            ? "TOTP authentication is active" 
                            : `SMS to ${factor.phone || "your phone"}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setFactorId(factor.id);
                        setShowDisableDialog(true);
                      }}
                    >
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Disable
                    </Button>
                  </div>
                ))}

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="font-medium">Recovery Codes</Label>
                      <p className="text-sm text-muted-foreground">
                        {hasRecoveryCodes 
                          ? "Backup codes available for account recovery"
                          : "No recovery codes generated"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRegenerateDialog(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {enabledFactors.length === 1 && (
                  <Button variant="outline" size="sm" onClick={() => setShowMethodSelect(true)}>
                    Add another method
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSuspendDialog(true)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Lost your authenticator?
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your account is not protected with two-factor authentication.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="font-medium">Authenticator App</Label>
                      <p className="text-sm text-muted-foreground">
                        Use Google Authenticator, Authy, or similar
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => handleSelectMethod("totp")} disabled={enrolling} size="sm">
                    {enrolling && selectedMethod === "totp" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Enable
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="font-medium">SMS</Label>
                      <p className="text-sm text-muted-foreground">Receive codes via text message</p>
                    </div>
                  </div>
                  <Button onClick={() => handleSelectMethod("phone")} disabled={enrolling} size="sm">
                    {enrolling && selectedMethod === "phone" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Enable
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Method Selection Dialog */}
      <Dialog open={showMethodSelect} onOpenChange={setShowMethodSelect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Another 2FA Method</DialogTitle>
            <DialogDescription>Choose an additional authentication method for backup</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            {!enabledFactors.some(f => f.factor_type === "totp") && (
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={() => handleSelectMethod("totp")}>
                <QrCode className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Authenticator App</div>
                  <div className="text-sm text-muted-foreground">Use Google Authenticator or similar</div>
                </div>
              </Button>
            )}
            {!enabledFactors.some(f => f.factor_type === "phone") && (
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3" onClick={() => handleSelectMethod("phone")}>
                <Phone className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">SMS</div>
                  <div className="text-sm text-muted-foreground">Receive codes via text message</div>
                </div>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={(open) => !open && resetEnrollState()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedMethod === "totp" ? "Set Up Authenticator App" : "Set Up SMS Verification"}
            </DialogTitle>
            <DialogDescription>
              {selectedMethod === "totp"
                ? "Scan the QR code with your authenticator app, then enter the 6-digit code"
                : phoneEnrollStep === "input"
                  ? "Enter your phone number to receive verification codes"
                  : "Enter the 6-digit code sent to your phone"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMethod === "totp" && qrCode && (
              <>
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-background border rounded-lg">
                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                  <div className="w-full space-y-2">
                    <Label className="text-sm text-muted-foreground">Or enter this code manually:</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">{secret}</code>
                      <Button variant="outline" size="icon" onClick={copySecret}>
                        {copied ? <CheckCircle className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetEnrollState} className="flex-1">Cancel</Button>
                  <Button onClick={handleVerifyEnrollment} disabled={verifying || verificationCode.length !== 6} className="flex-1">
                    {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Verify & Enable
                  </Button>
                </div>
              </>
            )}

            {selectedMethod === "phone" && phoneEnrollStep === "input" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone-number">Phone Number</Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="text-lg"
                  />
                  <p className="text-xs text-muted-foreground">Include country code (e.g., +234 for Nigeria)</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetEnrollState} className="flex-1">Cancel</Button>
                  <Button onClick={handleStartPhoneEnroll} disabled={enrolling || !phoneNumber.trim()} className="flex-1">
                    {enrolling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Send Code
                  </Button>
                </div>
              </>
            )}

            {selectedMethod === "phone" && phoneEnrollStep === "verify" && (
              <>
                <div className="text-center py-2">
                  <Smartphone className="h-12 w-12 mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Code sent to <span className="font-medium">{phoneNumber}</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-code">Verification Code</Label>
                  <Input
                    id="sms-code"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                </div>
                <Button variant="link" size="sm" onClick={handleResendSmsCode} disabled={enrolling} className="w-full">
                  {enrolling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Resend code
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetEnrollState} className="flex-1">Cancel</Button>
                  <Button onClick={handleVerifyEnrollment} disabled={verifying || verificationCode.length !== 6} className="flex-1">
                    {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Verify & Enable
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Recovery Codes Dialog */}
      <Dialog open={showRecoveryCodesDialog} onOpenChange={setShowRecoveryCodesDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Save Your Recovery Codes
            </DialogTitle>
            <DialogDescription>
              Store these codes safely. Each code can only be used once to recover your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>These codes won't be shown again. Download or copy them now!</AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="py-1">{code}</div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyRecoveryCodes} className="flex-1">
                {copied ? <CheckCircle className="h-4 w-4 mr-2 text-primary" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy
              </Button>
              <Button onClick={downloadRecoveryCodes} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowRecoveryCodesDialog(false)} className="w-full">
              I've saved my codes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Regenerate Recovery Codes Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Recovery Codes</DialogTitle>
            <DialogDescription>
              Enter your current 2FA code to generate new recovery codes. Your old codes will be invalidated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>This will invalidate all existing recovery codes.</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="regenerate-code">Verification Code</Label>
              <Input
                id="regenerate-code"
                placeholder="Enter 6-digit code"
                value={regenerateCode}
                onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowRegenerateDialog(false); setRegenerateCode(""); }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleRegenerateRecoveryCodes} disabled={regenerating || regenerateCode.length !== 6} className="flex-1">
                {regenerating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Regenerate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enter your current verification code to confirm disabling 2FA</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Disabling 2FA will make your account less secure.</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="disable-code">Verification Code</Label>
              <Input
                id="disable-code"
                placeholder="Enter 6-digit code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDisableDialog(false); setDisableCode(""); setFactorId(null); }} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const factor = factors.find(f => f.id === factorId);
                  if (factor) handleDisable2FA(factor);
                }}
                disabled={disabling || disableCode.length !== 6}
                className="flex-1"
              >
                {disabling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Disable 2FA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend 2FA Dialog (using recovery code) */}
      <Dialog open={showSuspendDialog} onOpenChange={(open) => {
        setShowSuspendDialog(open);
        if (!open) setSuspendRecoveryCode("");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-destructive" />
              Suspend Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Lost access to your authenticator? Enter one of your recovery codes to disable 2FA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will disable all 2FA methods and invalidate your remaining recovery codes.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="suspend-recovery-code">Recovery Code</Label>
              <Input
                id="suspend-recovery-code"
                placeholder="XXXXX-XXXXX"
                value={suspendRecoveryCode}
                onChange={(e) => setSuspendRecoveryCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter one of your 10-character recovery codes
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowSuspendDialog(false); setSuspendRecoveryCode(""); }} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSuspend2FA}
                disabled={suspending || suspendRecoveryCode.replace(/-/g, "").length < 10}
                className="flex-1"
              >
                {suspending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Suspend 2FA
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
