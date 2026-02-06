import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Two-Factor Authentication settings card.
 *
 * MFA enrollment, challenge and verification are now handled by Azure AD B2C /
 * Microsoft Entra External ID at the identity-provider level. This card
 * informs the user how to manage their MFA settings there.
 */
export function TwoFactorSettingsCard() {
  const { user } = useAuth();

  if (!user) return null;

  const securityUrl =
    "https://mysignins.microsoft.com/security-info";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Multi-factor authentication is managed by your Microsoft account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-primary/50 bg-primary/10">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">
            MFA is configured at your identity provider (Microsoft Entra ID).
            You can add or manage authenticator apps, phone numbers, and
            security keys from your Microsoft security settings.
          </AlertDescription>
        </Alert>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(securityUrl, "_blank", "noopener")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Manage MFA at Microsoft
        </Button>
      </CardContent>
    </Card>
  );
}
