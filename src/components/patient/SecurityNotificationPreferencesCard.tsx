import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Lock, 
  Unlock, 
  Key, 
  AlertTriangle, 
  Smartphone, 
  Users, 
  ShieldCheck, 
  ShieldOff,
  Download,
  UserCog,
  Mail,
  Bell
} from "lucide-react";
import { useSecurityNotificationPreferences } from "@/hooks/useSecurityNotificationPreferences";

interface AlertToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
  severity?: "critical" | "warning" | "info";
}

function AlertToggle({ icon, label, description, checked, onCheckedChange, disabled, severity = "info" }: AlertToggleProps) {
  const severityColors = {
    critical: "bg-destructive/10 border-destructive/20",
    warning: "bg-warning/10 border-warning/20",
    info: "bg-muted/50 border-border",
  };

  return (
    <div className={`flex items-start justify-between p-3 rounded-lg border ${severityColors[severity]} transition-colors`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor={label} className="font-medium cursor-pointer">
              {label}
            </Label>
            {severity === "critical" && (
              <Badge variant="destructive" className="text-xs">Critical</Badge>
            )}
            {severity === "warning" && (
              <Badge variant="secondary" className="text-xs bg-warning/20 text-warning-foreground">Important</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

export function SecurityNotificationPreferencesCard() {
  const { preferences, isLoading, togglePreference, isUpdating } = useSecurityNotificationPreferences();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Security Alert Preferences</CardTitle>
        </div>
        <CardDescription>
          Choose which security notifications you want to receive. We recommend keeping critical alerts enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delivery Channels */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Delivery Channels
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="email-channel" className="cursor-pointer">Email</Label>
              </div>
              <Switch
                id="email-channel"
                checked={preferences.email_enabled}
                onCheckedChange={() => togglePreference("email_enabled")}
                disabled={isUpdating}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="push-channel" className="cursor-pointer">Push Notifications</Label>
              </div>
              <Switch
                id="push-channel"
                checked={preferences.push_enabled}
                onCheckedChange={() => togglePreference("push_enabled")}
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Critical Alerts */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Critical Security Alerts
          </h4>
          <div className="space-y-2">
            <AlertToggle
              icon={<Lock className="h-4 w-4" />}
              label="Account Locked"
              description="Get notified when your account is locked due to failed login attempts"
              checked={preferences.notify_account_locked}
              onCheckedChange={() => togglePreference("notify_account_locked")}
              disabled={isUpdating}
              severity="critical"
            />
            <AlertToggle
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Suspicious Activity"
              description="Alerts for unusual account activity or potential security threats"
              checked={preferences.notify_suspicious_activity}
              onCheckedChange={() => togglePreference("notify_suspicious_activity")}
              disabled={isUpdating}
              severity="critical"
            />
            <AlertToggle
              icon={<Users className="h-4 w-4" />}
              label="Concurrent Session Blocked"
              description="When a login is blocked due to too many active sessions"
              checked={preferences.notify_concurrent_session_blocked}
              onCheckedChange={() => togglePreference("notify_concurrent_session_blocked")}
              disabled={isUpdating}
              severity="critical"
            />
          </div>
        </div>

        <Separator />

        {/* Password & Authentication */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Password & Authentication
          </h4>
          <div className="space-y-2">
            <AlertToggle
              icon={<Key className="h-4 w-4" />}
              label="Password Changed"
              description="Confirmation when your password is successfully changed"
              checked={preferences.notify_password_change}
              onCheckedChange={() => togglePreference("notify_password_change")}
              disabled={isUpdating}
              severity="warning"
            />
            <AlertToggle
              icon={<Key className="h-4 w-4" />}
              label="Password Reset"
              description="When a password reset is requested for your account"
              checked={preferences.notify_password_reset}
              onCheckedChange={() => togglePreference("notify_password_reset")}
              disabled={isUpdating}
              severity="warning"
            />
            <AlertToggle
              icon={<ShieldCheck className="h-4 w-4" />}
              label="MFA Enabled"
              description="Confirmation when two-factor authentication is enabled"
              checked={preferences.notify_mfa_enabled}
              onCheckedChange={() => togglePreference("notify_mfa_enabled")}
              disabled={isUpdating}
              severity="info"
            />
            <AlertToggle
              icon={<ShieldOff className="h-4 w-4" />}
              label="MFA Disabled"
              description="Alert when two-factor authentication is disabled"
              checked={preferences.notify_mfa_disabled}
              onCheckedChange={() => togglePreference("notify_mfa_disabled")}
              disabled={isUpdating}
              severity="warning"
            />
          </div>
        </div>

        <Separator />

        {/* Account Activity */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Account Activity
          </h4>
          <div className="space-y-2">
            <AlertToggle
              icon={<Unlock className="h-4 w-4" />}
              label="Account Unlocked"
              description="When your account is unlocked after a lockout period"
              checked={preferences.notify_account_unlocked}
              onCheckedChange={() => togglePreference("notify_account_unlocked")}
              disabled={isUpdating}
              severity="info"
            />
            <AlertToggle
              icon={<Smartphone className="h-4 w-4" />}
              label="New Device Login"
              description="When your account is accessed from a new device"
              checked={preferences.notify_new_device_login}
              onCheckedChange={() => togglePreference("notify_new_device_login")}
              disabled={isUpdating}
              severity="warning"
            />
            <AlertToggle
              icon={<Download className="h-4 w-4" />}
              label="Data Export"
              description="When your data is exported from the platform"
              checked={preferences.notify_data_export}
              onCheckedChange={() => togglePreference("notify_data_export")}
              disabled={isUpdating}
              severity="info"
            />
            <AlertToggle
              icon={<UserCog className="h-4 w-4" />}
              label="Permission Changes"
              description="When your account permissions or role are modified"
              checked={preferences.notify_permission_change}
              onCheckedChange={() => togglePreference("notify_permission_change")}
              disabled={isUpdating}
              severity="warning"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
