import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PasswordBreachWarningProps {
  count: number;
  className?: string;
}

export function PasswordBreachWarning({ count, className }: PasswordBreachWarningProps) {
  return (
    <Alert variant="destructive" className={className}>
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Compromised Password Detected
      </AlertTitle>
      <AlertDescription>
        This password has appeared in{" "}
        <strong>{count.toLocaleString()}</strong> known data breaches.
        Using this password puts your account at high risk. Please choose a
        different, unique password.
      </AlertDescription>
    </Alert>
  );
}
