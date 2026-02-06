import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Mail, Smartphone, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NotificationPreferences {
  email_reminders: boolean;
  in_app_reminders: boolean;
}

export function NotificationChannelsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data: prefs, error: prefsError } = await db
        .from("patient_notification_preferences")
        .select("email_reminders, in_app_reminders")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prefsError) {
        console.error("Error fetching preferences:", prefsError);
      }

      if (prefs) {
        setPreferences(prefs);
      } else {
        setPreferences({
          email_reminders: true,
          in_app_reminders: true,
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
      name: "Push",
      icon: Smartphone,
      enabled: preferences.in_app_reminders,
      description: "Browser notifications",
    },
  ] : [];

  const enabledCount = channels.filter(c => c.enabled).length;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[1, 2].map((i) => (
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
          <Badge variant={enabledCount >= 2 ? "default" : enabledCount >= 1 ? "secondary" : "destructive"} className="ml-2">
            {enabledCount} active
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs"
            onClick={() => navigate("/dashboard/settings")}
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            Manage
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.name}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                  channel.enabled
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-muted"
                }`}
              >
                <Icon
                  className={`h-5 w-5 mb-1.5 ${
                    channel.enabled
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-sm font-medium">{channel.name}</span>
                <span
                  className={`text-xs ${
                    channel.enabled
                      ? "text-primary/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {channel.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
