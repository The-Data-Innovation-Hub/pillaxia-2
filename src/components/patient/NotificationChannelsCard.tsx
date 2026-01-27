import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Mail, MessageSquare, Smartphone, Phone, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NotificationPreferences {
  email_reminders: boolean;
  sms_reminders: boolean;
  whatsapp_reminders: boolean;
  in_app_reminders: boolean;
  push_clinician_messages: boolean;
}

export function NotificationChannelsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPhone, setHasPhone] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      // Fetch notification preferences
      const { data: prefs, error: prefsError } = await supabase
        .from("patient_notification_preferences")
        .select("email_reminders, sms_reminders, whatsapp_reminders, in_app_reminders, push_clinician_messages")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefsError) {
        console.error("Error fetching preferences:", prefsError);
      }

      // Check if user has a phone number configured
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();

      setHasPhone(!!profile?.phone);

      // If no preferences exist, use defaults (all enabled)
      if (prefs) {
        setPreferences(prefs);
      } else {
        setPreferences({
          email_reminders: true,
          sms_reminders: true,
          whatsapp_reminders: true,
          in_app_reminders: true,
          push_clinician_messages: true,
        });
      }
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const channels = preferences ? [
    {
      name: "Email",
      icon: Mail,
      enabled: preferences.email_reminders,
      description: "Medication reminders",
    },
    {
      name: "SMS",
      icon: Phone,
      enabled: preferences.sms_reminders,
      description: hasPhone ? "Text messages" : "No phone set",
      warning: !hasPhone,
    },
    {
      name: "WhatsApp",
      icon: MessageSquare,
      enabled: preferences.whatsapp_reminders,
      description: hasPhone ? "WhatsApp messages" : "No phone set",
      warning: !hasPhone,
    },
    {
      name: "Push",
      icon: Smartphone,
      enabled: preferences.in_app_reminders || preferences.push_clinician_messages,
      description: "Browser notifications",
    },
  ] : [];

  const enabledCount = channels.filter(c => c.enabled && !c.warning).length;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 flex-1" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-medium">Notification Channels</CardTitle>
          <Badge variant={enabledCount >= 3 ? "default" : enabledCount >= 1 ? "secondary" : "destructive"} className="ml-2">
            {enabledCount} active
          </Badge>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs"
          onClick={() => navigate("/dashboard/settings")}
        >
          <Settings className="h-3.5 w-3.5 mr-1" />
          Manage
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.name}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                  channel.enabled && !channel.warning
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-muted"
                }`}
              >
                <Icon
                  className={`h-5 w-5 mb-1.5 ${
                    channel.enabled && !channel.warning
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-sm font-medium">{channel.name}</span>
                <span
                  className={`text-xs ${
                    channel.warning
                      ? "text-warning"
                      : channel.enabled
                      ? "text-primary/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {channel.enabled ? (channel.warning ? channel.description : "Enabled") : "Disabled"}
                </span>
              </div>
            );
          })}
        </div>
        {!hasPhone && (preferences?.sms_reminders || preferences?.whatsapp_reminders) && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            <Button 
              variant="link" 
              className="h-auto p-0 text-xs"
              onClick={() => navigate("/dashboard/health-profile")}
            >
              Add your phone number
            </Button>
            {" "}to enable SMS and WhatsApp notifications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
