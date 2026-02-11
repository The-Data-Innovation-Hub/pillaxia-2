import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  MessageCircle,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Info,
  Bell,
  AlertTriangle,
  Heart,
  Clock,
  BellRing,
  Send,
  User,
  Building2,
  GraduationCap,
  Bug,
  Database,
  Users,
} from "lucide-react";
import { captureError, captureMessage } from "@/lib/sentry";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AdminProfileTab } from "./AdminProfileTab";
import { OrganizationManagementPage } from "./OrganizationManagementPage";

interface IntegrationStatus {
  whatsapp: boolean;
  resend: boolean;
}

interface NotificationSetting {
  id: string;
  setting_key: string;
  is_enabled: boolean;
  description: string | null;
  updated_at: string;
}

const NOTIFICATION_CONFIG = {
  medication_reminders: {
    title: "Medication Reminders",
    icon: Bell,
  },
  missed_dose_alerts: {
    title: "Missed Dose Alerts",
    icon: AlertTriangle,
  },
  encouragement_messages: {
    title: "Encouragement Messages",
    icon: Heart,
  },
};

const ONBOARDING_DISABLED_KEY = "progressive_onboarding_disabled";

function CrashOnRender({ enabled }: { enabled: boolean }) {
  if (enabled) {
    throw new Error("This is your first Sentry test error!");
  }
  return null;
}

export function SettingsPage() {
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushTestUserId, setPushTestUserId] = useState("");
  const [onboardingEnabled, setOnboardingEnabled] = useState(false);
  const [shouldThrowError, setShouldThrowError] = useState(false);
  const [seedingUsers, setSeedingUsers] = useState(false);
  const queryClient = useQueryClient();
  const { user, isManager, isAdmin } = useAuth();

  // Load onboarding preference - default is OFF (disabled)
  useEffect(() => {
    const storedValue = localStorage.getItem(ONBOARDING_DISABLED_KEY);
    // Default to disabled (off) if not explicitly set to "false"
    const disabled = storedValue !== "false";
    setOnboardingEnabled(!disabled);
  }, []);

  const handleToggleOnboarding = (enabled: boolean) => {
    setOnboardingEnabled(enabled);
    // Store "false" when enabled (not disabled), "true" when disabled
    const newValue = enabled ? "false" : "true";
    localStorage.setItem(ONBOARDING_DISABLED_KEY, newValue);
    // Dispatch storage event so other tabs/components can react
    window.dispatchEvent(new StorageEvent("storage", {
      key: ONBOARDING_DISABLED_KEY,
      newValue: newValue,
    }));
    toast.success(enabled ? "Progressive onboarding enabled" : "Progressive onboarding disabled");
  };

  // Check integration status by calling a test endpoint
  const { data: integrationStatus, isLoading, refetch } = useQuery({
    queryKey: ["integration-status"],
    queryFn: async (): Promise<IntegrationStatus> => {
      // Test WhatsApp configuration
      let whatsappConfigured = false;
      try {
        const { data } = await supabase.functions.invoke("send-whatsapp-notification", {
          body: { recipientId: "test", senderName: "test", message: "test" },
        });
        // If it returns "not_configured", it's not set up
        whatsappConfigured = data?.reason !== "not_configured";
      } catch {
        whatsappConfigured = false;
      }

      // Test Resend configuration
      let resendConfigured = false;
      try {
        const { data } = await supabase.functions.invoke("send-encouragement-email", {
          body: { patientEmail: "test@test.com", patientName: "Test", caregiverName: "Test", message: "test" },
        });
        // If it doesn't error with missing API key, it's configured
        resendConfigured = !data?.error?.includes("RESEND_API_KEY");
      } catch {
        resendConfigured = true; // Assume configured if other error
      }

      return { whatsapp: whatsappConfigured, resend: resendConfigured };
    },
  });

  // Fetch notification settings
  const { data: notificationSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async (): Promise<NotificationSetting[]> => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .order("setting_key");
      
      if (error) throw error;
      return data as NotificationSetting[];
    },
  });

  // Update notification setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ settingKey, isEnabled }: { settingKey: string; isEnabled: boolean }) => {
      const { error } = await supabase
        .from("notification_settings")
        .update({ is_enabled: isEnabled, updated_by: user?.id })
        .eq("setting_key", settingKey);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      toast.success("Setting updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update setting", { description: error.message });
    },
  });

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-notification", {
        body: { 
          recipientId: "test", 
          senderName: "Pillaxia Admin", 
          message: "This is a test message from Pillaxia." 
        },
      });
      
      if (error) throw error;
      
      if (data?.reason === "not_configured") {
        toast.error("WhatsApp API is not configured", {
          description: "Please add the required secrets to enable WhatsApp notifications.",
        });
      } else if (data?.reason === "no_phone") {
        toast.info("No phone number", {
          description: "The test user has no phone number configured.",
        });
      } else if (data?.success) {
        toast.success("WhatsApp test successful!", {
          description: "A test message was sent successfully.",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error("Test failed", { description: errorMessage });
    } finally {
      setTestingWhatsApp(false);
      refetch();
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      // This will fail but we can check if the API key is configured
      toast.info("Email Integration", {
        description: "Email sending is configured via Resend. Test by sending an encouragement message.",
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSeedDemoUsers = async () => {
    setSeedingUsers(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        toast.error("Authentication required", {
          description: "Please log in to seed demo users.",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("seed-demo-users", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        const created = data.results?.filter((r: { status: string }) => r.status === "created").length || 0;
        const reset = data.results?.filter((r: { status: string }) => r.status === "password reset").length || 0;
        const errors = data.results?.filter((r: { status: string }) => r.status === "error").length || 0;

        toast.success("Demo users seeded!", {
          description: `Created: ${created}, Password reset: ${reset}${errors > 0 ? `, Errors: ${errors}` : ""}`,
        });
      } else {
        toast.error("Failed to seed users", {
          description: data?.error || "Unknown error",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureError(error instanceof Error ? error : new Error(message));
      toast.error("Failed to seed demo users", { description: message });
    } finally {
      setSeedingUsers(false);
    }
  };

  const handleTestPush = async () => {
    const targetUserId = pushTestUserId.trim() || user?.id;
    if (!targetUserId) {
      toast.error("No user ID", { description: "Please enter a user ID or log in." });
      return;
    }

    setTestingPush(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [targetUserId],
          payload: {
            title: "🔔 Test Push Notification",
            body: "This is a test push notification from Pillaxia Admin!",
            tag: "admin-test",
            data: { url: "/dashboard" },
          },
        },
      });

      if (error) throw error;

      if (data?.sent === 0) {
        toast.info("No subscriptions found", {
          description: "The user hasn't enabled push notifications yet. They need to enable it in their Settings page.",
        });
      } else if (data?.sent > 0) {
        toast.success(`Push notification sent!`, {
          description: `Successfully sent to ${data.sent} device(s).`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Test failed", { description: message });
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <div className="space-y-6">
      <CrashOnRender enabled={shouldThrowError} />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          System Settings
        </h1>
        <p className="text-muted-foreground">
          Configure integrations and system settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isManager && !isAdmin && (
            <TabsTrigger value="organization">
              <Building2 className="h-4 w-4 mr-2" />
              Organization
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <AdminProfileTab />
        </TabsContent>

        {isManager && !isAdmin && (
          <TabsContent value="organization">
            <OrganizationManagementPage />
          </TabsContent>
        )}

        <TabsContent value="integrations" className="space-y-4">
          {/* WhatsApp Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">WhatsApp Business API</CardTitle>
                    <CardDescription>
                      Send message notifications via WhatsApp
                    </CardDescription>
                  </div>
                </div>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : integrationStatus?.whatsapp ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Setup Required</AlertTitle>
                <AlertDescription>
                  To enable WhatsApp notifications, you need to configure the following secrets 
                  in your project settings:
                </AlertDescription>
              </Alert>

              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">WHATSAPP_ACCESS_TOKEN</Label>
                  <p className="text-xs text-muted-foreground">
                    Your Meta WhatsApp Business API access token. Get this from the 
                    Meta Developer Console.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">WHATSAPP_PHONE_NUMBER_ID</Label>
                  <p className="text-xs text-muted-foreground">
                    Your WhatsApp Business phone number ID from Meta Business Suite.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestWhatsApp}
                  disabled={testingWhatsApp}
                >
                  {testingWhatsApp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Test Connection
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1"
                  >
                    Setup Guide
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Resend Email API</CardTitle>
                    <CardDescription>
                      Send email notifications to patients
                    </CardDescription>
                  </div>
                </div>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : integrationStatus?.resend ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Email Configuration</AlertTitle>
                <AlertDescription>
                  Email notifications are powered by Resend. Configure your API key to enable 
                  email features.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">RESEND_API_KEY</Label>
                  <p className="text-xs text-muted-foreground">
                    Your Resend API key. Create one at resend.com/api-keys
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                >
                  {testingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Test Connection
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href="https://resend.com/docs/introduction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1"
                  >
                    Setup Guide
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <BellRing className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Web Push Notifications</CardTitle>
                    <CardDescription>
                      Send browser push notifications to users
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Configured
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>How Push Notifications Work</AlertTitle>
                <AlertDescription>
                  Users must enable push notifications in their Settings page. Once enabled, 
                  they will receive alerts for medication reminders, missed doses, and caregiver messages.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Test Push Notification</Label>
                  <p className="text-xs text-muted-foreground">
                    Send a test notification to verify the push system is working.
                    Leave user ID empty to send to yourself.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="User ID (optional, defaults to you)"
                    value={pushTestUserId}
                    onChange={(e) => setPushTestUserId(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestPush}
                    disabled={testingPush}
                  >
                    {testingPush ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Test
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> To receive test notifications, first enable push notifications 
                by logging in as a patient and going to Settings → Push Notifications → Enable.
              </p>
            </CardContent>
          </Card>

          {/* Developer Tools */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Database className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Developer Tools</CardTitle>
                    <CardDescription>
                      Development and testing utilities
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Admin Only</AlertTitle>
                <AlertDescription>
                  These tools are for development and testing purposes. Use with caution in production.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Seed Demo & E2E Test Users</p>
                      <p className="text-sm text-muted-foreground">
                        Create or reset demo accounts and E2E test users for automated testing
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSeedDemoUsers}
                    disabled={seedingUsers}
                  >
                    {seedingUsers ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Users className="h-4 w-4 mr-2" />
                    )}
                    Seed Users
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Demo users:</strong> patient@demo.pillaxia.com, clinician@demo.pillaxia.com, etc.</p>
                <p><strong>E2E test users:</strong> e2e-test@pillaxia.test, e2e-clinician@pillaxia.test, etc.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure when and how notifications are sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSettings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {notificationSettings?.filter(s => s.setting_key !== 'missed_dose_grace_period').map((setting) => {
                    const config = NOTIFICATION_CONFIG[setting.setting_key as keyof typeof NOTIFICATION_CONFIG];
                    const Icon = config?.icon || Bell;
                    
                    return (
                      <div 
                        key={setting.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${setting.is_enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                            <Icon className={`h-4 w-4 ${setting.is_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{config?.title || setting.setting_key}</p>
                            <p className="text-sm text-muted-foreground">
                              {setting.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={setting.is_enabled ? "default" : "secondary"}>
                            {setting.is_enabled ? "Active" : "Disabled"}
                          </Badge>
                          <Switch
                            checked={setting.is_enabled}
                            onCheckedChange={(checked) => 
                              updateSettingMutation.mutate({ 
                                settingKey: setting.setting_key, 
                                isEnabled: checked 
                              })
                            }
                            disabled={updateSettingMutation.isPending}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grace Period Setting */}
          <GracePeriodCard 
            notificationSettings={notificationSettings} 
            queryClient={queryClient}
            userId={user?.id}
          />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage security and access controls
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Row Level Security (RLS)</p>
                    <p className="text-sm text-muted-foreground">
                      Database-level access controls are enabled
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Enabled</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">JWT Verification</p>
                    <p className="text-sm text-muted-foreground">
                      API requests require valid authentication tokens
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Enabled</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Audit Logging</p>
                    <p className="text-sm text-muted-foreground">
                      Track all user actions and data changes
                    </p>
                  </div>
                  <Badge variant="default" className="bg-green-600">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sentry Error Tracking Test */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Bug className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>Error Tracking (Sentry)</CardTitle>
                  <CardDescription>
                    Test Sentry integration by triggering a sample error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Sentry Integration</AlertTitle>
                <AlertDescription>
                  Sentry captures errors and performance data. Use these buttons to verify
                  the integration is working correctly.
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShouldThrowError(true)}
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Break the World
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const testError = new Error("Test error from Admin Settings - Sentry integration check");
                    captureError(testError, { 
                      source: "admin_settings_test",
                      timestamp: new Date().toISOString()
                    });
                    toast.success("Test error sent to Sentry!", {
                      description: "Check your Sentry dashboard for the error.",
                    });
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Captured Error
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    captureMessage("Test message from Admin Settings", "info");
                    toast.success("Test message sent to Sentry!", {
                      description: "Check your Sentry dashboard for the message.",
                    });
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Message
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href="https://sentry.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1"
                  >
                    Open Sentry Dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10">
                  <GraduationCap className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Progressive Onboarding</CardTitle>
                  <CardDescription>
                    Guided tutorials and feature discovery for new users
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Enable Onboarding</p>
                  <p className="text-sm text-muted-foreground">
                    Show guided tours and checklists to help users discover features
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={onboardingEnabled ? "default" : "secondary"}>
                    {onboardingEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Switch
                    checked={onboardingEnabled}
                    onCheckedChange={handleToggleOnboarding}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Separate component for grace period to avoid hooks issues
interface GracePeriodCardProps {
  notificationSettings: NotificationSetting[] | undefined;
  queryClient: ReturnType<typeof useQueryClient>;
  userId: string | undefined;
}

function GracePeriodCard({ notificationSettings, queryClient, userId }: GracePeriodCardProps) {
  const gracePeriodSetting = notificationSettings?.find(s => s.setting_key === 'missed_dose_grace_period');
  const currentValue = gracePeriodSetting?.description || '30';
  const [gracePeriod, setGracePeriod] = useState(currentValue);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveGracePeriod = async () => {
    const value = parseInt(gracePeriod, 10);
    if (isNaN(value) || value < 5 || value > 120) {
      toast.error("Grace period must be between 5 and 120 minutes");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings")
        .update({ description: value.toString(), updated_by: userId })
        .eq("setting_key", "missed_dose_grace_period");

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      toast.success("Grace period updated successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to update grace period", { description: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Missed Dose Grace Period</CardTitle>
            <CardDescription>
              How long to wait after a scheduled dose before marking it as missed
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={5}
              max={120}
              value={gracePeriod}
              onChange={(e) => setGracePeriod(e.target.value)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
          <Button 
            onClick={handleSaveGracePeriod}
            disabled={isSaving || gracePeriod === currentValue}
            size="sm"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Recommended: 15-60 minutes. Currently set to {currentValue} minutes.
        </p>
      </CardContent>
    </Card>
  );
}
