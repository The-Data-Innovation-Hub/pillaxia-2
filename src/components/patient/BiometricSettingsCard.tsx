import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Fingerprint, Smartphone, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHaptics } from "@/hooks/useHaptics";

export function BiometricSettingsCard() {
  const { user } = useAuth();
  const haptics = useHaptics();
  const {
    isAvailable,
    isEnabled,
    isLoading,
    biometryName,
    enableBiometric,
    disableBiometric,
  } = useBiometricAuth();

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      // Need password to enable biometric login
      setShowPasswordDialog(true);
    } else {
      // Disable biometric login
      setIsProcessing(true);
      const success = await disableBiometric();
      setIsProcessing(false);

      if (success) {
        toast.success(`${biometryName} login disabled`);
      } else {
        toast.error("Failed to disable biometric login");
      }
    }
  };

  const handleEnableBiometric = async () => {
    if (!password || !user?.email) {
      toast.error("Please enter your password");
      await haptics.error();
      return;
    }

    setIsProcessing(true);
    const success = await enableBiometric(user.email, password);
    setIsProcessing(false);

    if (success) {
      await haptics.success();
      toast.success(`${biometryName} login enabled`);
      setShowPasswordDialog(false);
      setPassword("");
    } else {
      await haptics.error();
      toast.error("Failed to enable biometric login. Verification cancelled or failed.");
    }
  };

  // Show nothing if loading
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Show message if not on native platform
  if (!isAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Biometric Login
          </CardTitle>
          <CardDescription>
            Use Face ID, Touch ID, or fingerprint to sign in quickly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              Biometric login is only available on the mobile app. Download the Pillaxia app on your iOS or Android device to use this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Biometric Login
          </CardTitle>
          <CardDescription>
            Use {biometryName} to sign in quickly and securely
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="biometric-toggle" className="text-base">
                Enable {biometryName}
              </Label>
              <p className="text-sm text-muted-foreground">
                Sign in with a quick scan instead of typing your password
              </p>
            </div>
            <Switch
              id="biometric-toggle"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={isProcessing}
            />
          </div>

          {isEnabled && (
            <Alert className="border-primary/50 bg-primary/5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <AlertDescription>
                {biometryName} is enabled. You can sign in using biometrics on this device.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your login credentials are stored securely on your device</li>
              <li>Credentials are protected by {biometryName}</li>
              <li>Only you can access them with your biometric</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Password confirmation dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Enable {biometryName} Login
            </DialogTitle>
            <DialogDescription>
              Enter your password to enable biometric login. Your credentials will be stored securely on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your password is only stored locally on this device and is protected by {biometryName}.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnableBiometric}
              disabled={!password || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enable {biometryName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
