import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Clock,
  Users,
  Lock,
  Key,
  AlertTriangle,
  Save,
  Database,
  FileText,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

interface SecuritySetting {
  id: string;
  setting_key: string;
  setting_value: Json;
  description: string | null;
}

export function SecuritySettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editedSettings, setEditedSettings] = useState<Record<string, number | boolean>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["security-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      return data as SecuritySetting[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { key: string; value: number | boolean }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("security_settings")
          .update({
            setting_value: { value: update.value },
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq("setting_key", update.key);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-settings"] });
      setEditedSettings({});
      toast.success("Security settings updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update settings", { description: error.message });
    },
  });

  const getValue = (key: string): number | boolean => {
    if (editedSettings[key] !== undefined) {
      return editedSettings[key];
    }
    const setting = settings?.find((s) => s.setting_key === key);
    const settingValue = setting?.setting_value as Record<string, unknown> | null;
    return (settingValue?.value as number | boolean) ?? 0;
  };

  const handleChange = (key: string, value: number | boolean) => {
    setEditedSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const updates = Object.entries(editedSettings).map(([key, value]) => ({
      key,
      value,
    }));
    if (updates.length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const hasChanges = Object.keys(editedSettings).length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security Settings
          </h1>
          <p className="text-muted-foreground">
            Configure security policies and compliance settings
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>HIPAA & NDPR Compliance</AlertTitle>
        <AlertDescription>
          These settings help maintain compliance with healthcare data protection regulations.
          Changes are logged in the audit trail.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Session Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Session Management
            </CardTitle>
            <CardDescription>
              Control session timeouts and concurrent session limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  min={5}
                  max={120}
                  value={getValue("session_timeout_minutes") as number}
                  onChange={(e) =>
                    handleChange("session_timeout_minutes", parseInt(e.target.value) || 30)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Automatically log out users after this period of inactivity
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_sessions">Max Concurrent Sessions</Label>
                <Input
                  id="max_sessions"
                  type="number"
                  min={1}
                  max={10}
                  value={getValue("max_concurrent_sessions") as number}
                  onChange={(e) =>
                    handleChange("max_concurrent_sessions", parseInt(e.target.value) || 3)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum devices a user can be logged in from simultaneously
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Login Security
            </CardTitle>
            <CardDescription>
              Configure account lockout and failed login policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lockout_attempts">Failed Login Attempts Before Lockout</Label>
                <Input
                  id="lockout_attempts"
                  type="number"
                  min={3}
                  max={10}
                  value={getValue("failed_login_lockout_attempts") as number}
                  onChange={(e) =>
                    handleChange("failed_login_lockout_attempts", parseInt(e.target.value) || 5)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lockout_duration">Lockout Duration (minutes)</Label>
                <Input
                  id="lockout_duration"
                  type="number"
                  min={5}
                  max={60}
                  value={getValue("failed_login_lockout_minutes") as number}
                  onChange={(e) =>
                    handleChange("failed_login_lockout_minutes", parseInt(e.target.value) || 15)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password Policy
            </CardTitle>
            <CardDescription>
              Set password complexity requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password_length">Minimum Password Length</Label>
              <Input
                id="password_length"
                type="number"
                min={8}
                max={32}
                value={getValue("password_min_length") as number}
                onChange={(e) =>
                  handleChange("password_min_length", parseInt(e.target.value) || 8)
                }
                className="w-32"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Special Characters</Label>
                  <p className="text-xs text-muted-foreground">
                    Passwords must include !@#$%^&* etc.
                  </p>
                </div>
                <Switch
                  checked={getValue("password_require_special") as boolean}
                  onCheckedChange={(checked) =>
                    handleChange("password_require_special", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Numbers</Label>
                  <p className="text-xs text-muted-foreground">
                    Passwords must include at least one number
                  </p>
                </div>
                <Switch
                  checked={getValue("password_require_numbers") as boolean}
                  onCheckedChange={(checked) =>
                    handleChange("password_require_numbers", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Uppercase Letters</Label>
                  <p className="text-xs text-muted-foreground">
                    Passwords must include uppercase characters
                  </p>
                </div>
                <Switch
                  checked={getValue("password_require_uppercase") as boolean}
                  onCheckedChange={(checked) =>
                    handleChange("password_require_uppercase", checked)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MFA Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Multi-Factor Authentication
            </CardTitle>
            <CardDescription>
              Require MFA for specific user roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require MFA for Admins</Label>
                <p className="text-xs text-muted-foreground">
                  Admin accounts must have MFA enabled
                </p>
              </div>
              <Switch
                checked={getValue("require_mfa_for_admin") as boolean}
                onCheckedChange={(checked) =>
                  handleChange("require_mfa_for_admin", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require MFA for Clinicians</Label>
                <p className="text-xs text-muted-foreground">
                  Clinician accounts must have MFA enabled
                </p>
              </div>
              <Switch
                checked={getValue("require_mfa_for_clinician") as boolean}
                onCheckedChange={(checked) =>
                  handleChange("require_mfa_for_clinician", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Retention
            </CardTitle>
            <CardDescription>
              HIPAA requires 6-7 years retention for healthcare records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert variant="destructive" className="bg-yellow-50 border-yellow-200 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Compliance Warning</AlertTitle>
              <AlertDescription>
                HIPAA requires retention of medical records for at least 6 years.
                NDPR requires data to be retained only as long as necessary.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="data_retention">Data Retention (days)</Label>
                <Input
                  id="data_retention"
                  type="number"
                  min={365}
                  max={3650}
                  value={getValue("data_retention_days") as number}
                  onChange={(e) =>
                    handleChange("data_retention_days", parseInt(e.target.value) || 2555)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  2555 days = 7 years (HIPAA recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="audit_retention">Audit Log Retention (days)</Label>
                <Input
                  id="audit_retention"
                  type="number"
                  min={365}
                  max={3650}
                  value={getValue("audit_log_retention_days") as number}
                  onChange={(e) =>
                    handleChange("audit_log_retention_days", parseInt(e.target.value) || 2555)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PHI Access Logging */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Protected Health Information (PHI)
            </CardTitle>
            <CardDescription>
              Configure logging for access to protected health information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable PHI Access Logging</Label>
                <p className="text-xs text-muted-foreground">
                  Log all access to patient health information for HIPAA compliance
                </p>
              </div>
              <Switch
                checked={getValue("phi_access_logging") as boolean}
                onCheckedChange={(checked) =>
                  handleChange("phi_access_logging", checked)
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
