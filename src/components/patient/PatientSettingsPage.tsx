import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  BellRing,
  Mail,
  Smartphone,
  Moon,
  Clock,
  AlertTriangle,
  Heart,
  Pill,
  Loader2,
} from "lucide-react";

interface NotificationPreferences {
  id: string;
  user_id: string;
  email_reminders: boolean;
  in_app_reminders: boolean;
  email_missed_alerts: boolean;
  in_app_missed_alerts: boolean;
  email_encouragements: boolean;
  in_app_encouragements: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "id" | "user_id"> = {
  email_reminders: true,
  in_app_reminders: true,
  email_missed_alerts: true,
  in_app_missed_alerts: true,
  email_encouragements: true,
  in_app_encouragements: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};

export function PatientSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pushNotifications = usePushNotifications();

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

  // Create default preferences if they don't exist
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

  // Auto-create preferences if they don't exist
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

  if (isLoading || (!preferences && createDefaultsMutation.isPending)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your notification preferences</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const prefs = preferences || { ...DEFAULT_PREFERENCES, id: "", user_id: user?.id || "" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage how you receive notifications and reminders
        </p>
      </div>

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
