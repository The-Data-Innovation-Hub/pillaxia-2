import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PushDebugPanel } from "@/components/patient/PushDebugPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  BellRing,
  Mail,
  Smartphone,
  MessageCircle,
  Moon,
  Clock,
  AlertTriangle,
  Heart,
  Pill,
  Loader2,
  Send,
  Stethoscope,
  MessageSquare,
  CheckCircle,
} from "lucide-react";

interface NotificationPreferences {
  id: string;
  user_id: string;
  email_reminders: boolean;
  sms_reminders: boolean;
  in_app_reminders: boolean;
  email_missed_alerts: boolean;
  in_app_missed_alerts: boolean;
  email_encouragements: boolean;
  in_app_encouragements: boolean;
  email_clinician_messages: boolean;
  push_clinician_messages: boolean;
  whatsapp_clinician_messages: boolean;
  sms_clinician_messages: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "id" | "user_id"> = {
  email_reminders: true,
  sms_reminders: true,
  in_app_reminders: true,
  email_missed_alerts: true,
  in_app_missed_alerts: true,
  email_encouragements: true,
  in_app_encouragements: true,
  email_clinician_messages: true,
  push_clinician_messages: true,
  whatsapp_clinician_messages: true,
  sms_clinician_messages: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};

export function NotificationsSettingsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushNotifications = usePushNotifications();
  
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingAllChannelsTest, setSendingAllChannelsTest] = useState(false);
  const [lastPushTest, setLastPushTest] = useState<
    { at: string; ok: boolean; summary: string } | null
  >(null);
  const [allChannelsTestResult, setAllChannelsTestResult] = useState<{
    at: string;
    results: Array<{ channel: string; success: boolean; message: string; provider?: string }>;
  } | null>(null);

  const formatUnknownError = (err: unknown): string => {
    const anyErr = err as any;
    const name = typeof anyErr?.name === "string" ? anyErr.name : undefined;
    const message =
      typeof anyErr?.message === "string"
        ? anyErr.message
        : typeof err === "string"
          ? err
          : "Unknown error";
    const status = anyErr?.context?.status ?? anyErr?.status;
    const statusPart = typeof status === "number" ? `HTTP ${status}` : undefined;
    return [name, statusPart, message].filter(Boolean).join(" — ");
  };

  const handleSendTestNotification = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "Your session ended. Sign in again to send a test notification.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [user.id],
          payload: {
            title: "🎉 Test Notification",
            body: "Push notifications are working! You'll receive medication reminders here.",
            tag: "patient-test",
            data: { url: "/dashboard/settings" },
          },
        },
      });

      if (error) throw error;

      if (data?.sent === 0) {
        setLastPushTest({
          at: new Date().toLocaleString(),
          ok: false,
          summary: "No active subscription found in backend",
        });
        toast({
          title: "No active push subscription",
          description: "Please click Enable (or re-enable) push notifications, then try again.",
          variant: "destructive",
        });
        return;
      }

      setLastPushTest({
        at: new Date().toLocaleString(),
        ok: true,
        summary: `Sent to ${data?.sent ?? 0} device(s)`,
      });
      toast({
        title: "Test notification sent",
        description: "Check your browser for the notification.",
      });
    } catch (error) {
      const summary = formatUnknownError(error);
      console.error("Failed to send test notification:", error);
      setLastPushTest({ at: new Date().toLocaleString(), ok: false, summary });
      toast({
        title: "Failed to send test",
        description: summary,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendAllChannelsTest = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "Your session ended. Sign in again to send test notifications.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setSendingAllChannelsTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-notifications", {
        body: { user_id: user.id },
      });

      if (error) throw error;

      const results = data?.results || [];
      setAllChannelsTestResult({
        at: new Date().toLocaleString(),
        results,
      });

      const successCount = results.filter((r: any) => r.success).length;
      
      if (successCount === results.length) {
        toast({
          title: "All tests passed!",
          description: `Successfully sent ${successCount} test notification(s).`,
        });
      } else if (successCount > 0) {
        toast({
          title: "Partial success",
          description: `${successCount} of ${results.length} channels worked. Check results below.`,
        });
      } else {
        toast({
          title: "Tests failed",
          description: "No test notifications were sent. Check your settings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to send test notifications:", error);
      toast({
        title: "Test failed",
        description: "Could not send test notifications. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingAllChannelsTest(false);
    }
  };

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["patient-notification-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("patient_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as NotificationPreferences | null;
    },
    enabled: !!user,
  });

  const createDefaultsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("patient_notification_preferences")
        .insert({ user_id: user.id, ...DEFAULT_PREFERENCES })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notification-preferences"] });
    },
  });

  useEffect(() => {
    if (!isLoading && !preferences && user) {
      createDefaultsMutation.mutate();
    }
  }, [isLoading, preferences, user]);

  const updatePreferenceMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("patient_notification_preferences")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notification-preferences"] });
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: (error) => {
      console.error("Failed to update preferences:", error);
      toast({
        title: "Failed to save",
        description: "Could not update your preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferenceMutation.mutate({ [key]: value });
  };

  const handleTimeChange = (key: "quiet_hours_start" | "quiet_hours_end", value: string) => {
    updatePreferenceMutation.mutate({ [key]: value });
  };

  const prefs = preferences || { ...DEFAULT_PREFERENCES, id: "", user_id: user?.id || "" };

  return (
    <div className="space-y-6">
      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications even when the app isn't open
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushNotifications.isSupported ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Push notifications are not supported in this browser. Try using Chrome, Firefox, or Edge.
              </AlertDescription>
            </Alert>
          ) : pushNotifications.permission === "denied" ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">Push notifications are blocked by your browser.</p>
                <p className="text-sm">To enable them:</p>
                <ol className="text-sm list-decimal list-inside space-y-1 ml-2">
                  <li>Click the lock/info icon in your browser's address bar</li>
                  <li>Find "Notifications" in the site settings</li>
                  <li>Change from "Block" to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">
                      Enable Push Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {pushNotifications.isSubscribed
                        ? "You'll receive push notifications for important alerts"
                        : "Get notified even when you're not using the app"}
                    </p>
                  </div>
                </div>
                {pushNotifications.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    variant={pushNotifications.isSubscribed ? "outline" : "default"}
                    size="sm"
                    onClick={() =>
                      pushNotifications.isSubscribed
                        ? pushNotifications.unsubscribe()
                        : pushNotifications.subscribe()
                    }
                  >
                    {pushNotifications.isSubscribed ? "Disable" : "Enable"}
                  </Button>
                )}
              </div>

              <PushDebugPanel
                userId={user?.id}
                isSupported={pushNotifications.isSupported}
                permission={pushNotifications.permission}
                lastTestResult={lastPushTest}
              />
              
              {pushNotifications.isSubscribed && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="font-medium">Test Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Send a test notification to verify it's working
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendTestNotification}
                      disabled={sendingTest}
                    >
                      {sendingTest ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Test
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test All Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Test All Notification Channels
          </CardTitle>
          <CardDescription>
            Send a test message to all enabled channels to verify they're working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <Label className="font-medium">Test All Channels</Label>
                <p className="text-sm text-muted-foreground">
                  Email, SMS, WhatsApp, and Push notifications
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleSendAllChannelsTest}
              disabled={sendingAllChannelsTest}
            >
              {sendingAllChannelsTest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sendingAllChannelsTest ? "Sending..." : "Test All"}
            </Button>
          </div>

          {allChannelsTestResult && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Results from {allChannelsTestResult.at}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allChannelsTestResult.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                        result.success
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium capitalize">{result.channel}</span>
                        {result.provider && (
                          <span className="text-xs opacity-70"> ({result.provider})</span>
                        )}
                        <p className="text-xs truncate opacity-80">{result.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Medication Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Medication Reminders
          </CardTitle>
          <CardDescription>
            Choose how you want to be reminded to take your medications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="email_reminders" className="font-medium">
                  Email Reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive medication reminders via email
                </p>
              </div>
            </div>
            <Switch
              id="email_reminders"
              checked={prefs.email_reminders}
              onCheckedChange={(checked) => handleToggle("email_reminders", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="sms_reminders" className="font-medium">
                  SMS Reminders
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive medication reminders via text message
                </p>
              </div>
            </div>
            <Switch
              id="sms_reminders"
              checked={prefs.sms_reminders}
              onCheckedChange={(checked) => handleToggle("sms_reminders", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="in_app_reminders" className="font-medium">
                  In-App Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive reminders within the app
                </p>
              </div>
            </div>
            <Switch
              id="in_app_reminders"
              checked={prefs.in_app_reminders}
              onCheckedChange={(checked) => handleToggle("in_app_reminders", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Missed Dose Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Missed Dose Alerts
          </CardTitle>
          <CardDescription>
            Get notified when you miss a scheduled dose
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="email_missed_alerts" className="font-medium">
                  Email Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive missed dose alerts via email
                </p>
              </div>
            </div>
            <Switch
              id="email_missed_alerts"
              checked={prefs.email_missed_alerts}
              onCheckedChange={(checked) => handleToggle("email_missed_alerts", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="in_app_missed_alerts" className="font-medium">
                  In-App Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  See missed dose alerts in the app
                </p>
              </div>
            </div>
            <Switch
              id="in_app_missed_alerts"
              checked={prefs.in_app_missed_alerts}
              onCheckedChange={(checked) => handleToggle("in_app_missed_alerts", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Encouragement Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Encouragement Messages
          </CardTitle>
          <CardDescription>
            Receive supportive messages from your caregivers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="email_encouragements" className="font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive encouragement messages via email
                </p>
              </div>
            </div>
            <Switch
              id="email_encouragements"
              checked={prefs.email_encouragements}
              onCheckedChange={(checked) => handleToggle("email_encouragements", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="in_app_encouragements" className="font-medium">
                  In-App Messages
                </Label>
                <p className="text-sm text-muted-foreground">
                  See encouragement messages in the app
                </p>
              </div>
            </div>
            <Switch
              id="in_app_encouragements"
              checked={prefs.in_app_encouragements}
              onCheckedChange={(checked) => handleToggle("in_app_encouragements", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Clinician Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Clinician Messages
          </CardTitle>
          <CardDescription>
            Choose how you receive messages from your healthcare providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="email_clinician_messages" className="font-medium">
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive an email when your clinician sends a message
                </p>
              </div>
            </div>
            <Switch
              id="email_clinician_messages"
              checked={prefs.email_clinician_messages}
              onCheckedChange={(checked) => handleToggle("email_clinician_messages", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="push_clinician_messages" className="font-medium">
                  Push Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get push alerts for new clinician messages
                </p>
              </div>
            </div>
            <Switch
              id="push_clinician_messages"
              checked={prefs.push_clinician_messages}
              onCheckedChange={(checked) => handleToggle("push_clinician_messages", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="whatsapp_clinician_messages" className="font-medium">
                  WhatsApp Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive WhatsApp messages for clinician communications
                </p>
              </div>
            </div>
            <Switch
              id="whatsapp_clinician_messages"
              checked={prefs.whatsapp_clinician_messages}
              onCheckedChange={(checked) => handleToggle("whatsapp_clinician_messages", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="sms_clinician_messages" className="font-medium">
                  SMS Notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive text messages for clinician communications
                </p>
              </div>
            </div>
            <Switch
              id="sms_clinician_messages"
              checked={prefs.sms_clinician_messages}
              onCheckedChange={(checked) => handleToggle("sms_clinician_messages", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-primary" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set a time window when you don't want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="quiet_hours_enabled" className="font-medium">
                  Enable Quiet Hours
                </Label>
                <p className="text-sm text-muted-foreground">
                  Pause notifications during set hours
                </p>
              </div>
            </div>
            <Switch
              id="quiet_hours_enabled"
              checked={prefs.quiet_hours_enabled}
              onCheckedChange={(checked) => handleToggle("quiet_hours_enabled", checked)}
              disabled={updatePreferenceMutation.isPending}
            />
          </div>

          {prefs.quiet_hours_enabled && (
            <>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quiet_hours_start" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Start Time
                  </Label>
                  <Input
                    id="quiet_hours_start"
                    type="time"
                    value={prefs.quiet_hours_start?.slice(0, 5) || "22:00"}
                    onChange={(e) => handleTimeChange("quiet_hours_start", e.target.value)}
                    disabled={updatePreferenceMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet_hours_end" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    End Time
                  </Label>
                  <Input
                    id="quiet_hours_end"
                    type="time"
                    value={prefs.quiet_hours_end?.slice(0, 5) || "07:00"}
                    onChange={(e) => handleTimeChange("quiet_hours_end", e.target.value)}
                    disabled={updatePreferenceMutation.isPending}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Notifications will be silenced between {prefs.quiet_hours_start?.slice(0, 5) || "22:00"} and {prefs.quiet_hours_end?.slice(0, 5) || "07:00"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
