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
} from "lucide-react";

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  phone?: string;
}

type MFAMethod = "totp" | "phone";

export function TwoFactorSettingsCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showMethodSelect, setShowMethodSelect] = useState(false);
  
  // TOTP state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  
  // Common state
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<MFAMethod>("totp");
  
  // Phone state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneEnrollStep, setPhoneEnrollStep] = useState<"input" | "verify">("input");

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
    } catch (error: any) {
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
      
      // Challenge immediately to send SMS
      const { error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: data.id,
      });

      if (challengeError) throw challengeError;

      setPhoneEnrollStep("verify");
      toast({
        title: "Code sent",
        description: `A verification code has been sent to ${phoneNumber}`,
      });
    } catch (error: any) {
      console.error("Error enrolling phone MFA:", error);
      toast({
        title: "Failed to set up SMS 2FA",
        description: error.message || "Could not send verification code. Please check your phone number.",
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
      if (selectedMethod === "totp") {
        const { data: challengeData, error: challengeError } = 
          await supabase.auth.mfa.challenge({ factorId });

        if (challengeError) throw challengeError;

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code: verificationCode,
        });

        if (verifyError) throw verifyError;
      } else {
        // For phone, we already sent the challenge during enrollment
        const { data: factorData } = await supabase.auth.mfa.listFactors();
        const phoneFactor = factorData?.phone?.find(f => f.id === factorId);
        
        if (phoneFactor) {
          const { data: challengeData, error: challengeError } = 
            await supabase.auth.mfa.challenge({ factorId });

          if (challengeError) throw challengeError;

          const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code: verificationCode,
          });

          if (verifyError) throw verifyError;
        }
      }

      toast({
        title: "Two-factor authentication enabled",
        description: `Your account is now protected with ${selectedMethod === "totp" ? "authenticator app" : "SMS"} 2FA.`,
      });

      resetEnrollState();
      fetchFactors();
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast({
        title: "Verification failed",
        description: error.message || "Invalid code. Please try again.",
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
    } catch (error: any) {
      toast({
        title: "Failed to resend code",
        description: error.message || "Could not resend verification code.",
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

      toast({
        title: "Two-factor authentication disabled",
        description: `${factor.factor_type === "totp" ? "Authenticator app" : "SMS"} 2FA has been removed from your account.`,
      });

      setShowDisableDialog(false);
      setDisableCode("");
      setFactorId(null);
      fetchFactors();
    } catch (error: any) {
      console.error("Error disabling MFA:", error);
      toast({
        title: "Failed to disable 2FA",
        description: error.message || "Invalid code or error occurred.",
        variant: "destructive",
      });
    } finally {
      setDisabling(false);
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
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const openDisableDialog = (factor: MFAFactor) => {
    setFactorId(factor.id);
    setShowDisableDialog(true);
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
                      onClick={() => openDisableDialog(factor)}
                    >
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Disable
                    </Button>
                  </div>
                ))}
              </div>

              {/* Option to add another method */}
              {enabledFactors.length === 1 && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMethodSelect(true)}
                  >
                    Add another method
                  </Button>
                </div>
              )}
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
                  <Button
                    onClick={() => handleSelectMethod("totp")}
                    disabled={enrolling}
                    size="sm"
                  >
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
                      <p className="text-sm text-muted-foreground">
                        Receive codes via text message
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleSelectMethod("phone")}
                    disabled={enrolling}
                    size="sm"
                  >
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

      {/* Method Selection Dialog (for adding second method) */}
      <Dialog open={showMethodSelect} onOpenChange={setShowMethodSelect}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Another 2FA Method</DialogTitle>
            <DialogDescription>
              Choose an additional authentication method for backup
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            {!enabledFactors.some(f => f.factor_type === "totp") && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleSelectMethod("totp")}
              >
                <QrCode className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Authenticator App</div>
                  <div className="text-sm text-muted-foreground">Use Google Authenticator or similar</div>
                </div>
              </Button>
            )}
            
            {!enabledFactors.some(f => f.factor_type === "phone") && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleSelectMethod("phone")}
              >
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
              {selectedMethod === "totp" 
                ? "Set Up Authenticator App" 
                : "Set Up SMS Verification"}
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
                    <Label className="text-sm text-muted-foreground">
                      Or enter this code manually:
                    </Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                        {secret}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={copySecret}
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
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
                  <Button
                    variant="outline"
                    onClick={resetEnrollState}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleVerifyEnrollment}
                    disabled={verifying || verificationCode.length !== 6}
                    className="flex-1"
                  >
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
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +234 for Nigeria)
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={resetEnrollState}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartPhoneEnroll}
                    disabled={enrolling || !phoneNumber.trim()}
                    className="flex-1"
                  >
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

                <Button
                  variant="link"
                  size="sm"
                  onClick={handleResendSmsCode}
                  disabled={enrolling}
                  className="w-full"
                >
                  {enrolling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Resend code
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={resetEnrollState}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleVerifyEnrollment}
                    disabled={verifying || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Verify & Enable
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your current verification code to confirm disabling 2FA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Disabling 2FA will make your account less secure. Only proceed if necessary.
              </AlertDescription>
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
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableDialog(false);
                  setDisableCode("");
                  setFactorId(null);
                }}
                className="flex-1"
              >
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
    </>
  );
}