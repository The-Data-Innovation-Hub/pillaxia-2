import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Smartphone, MessageCircle, RefreshCw, CheckCircle, XCircle, Clock, Send, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface NotificationRecord {
  id: string;
  channel: "push" | "email" | "in_app" | "whatsapp";
  notification_type: string;
  title: string;
  body: string | null;
  status: "sent" | "delivered" | "failed" | "pending";
  error_message: string | null;
  created_at: string;
}

const channelIcons = {
  push: Smartphone,
  email: Mail,
  in_app: Bell,
  whatsapp: MessageCircle,
};

const channelLabels = {
  push: "Push",
  email: "Email",
  in_app: "In-App",
  whatsapp: "WhatsApp",
};

const statusConfig = {
  sent: { icon: Send, color: "bg-blue-500", label: "Sent" },
  delivered: { icon: CheckCircle, color: "bg-green-500", label: "Delivered" },
  failed: { icon: XCircle, color: "bg-destructive", label: "Failed" },
  pending: { icon: Clock, color: "bg-yellow-500", label: "Pending" },
};

export function NotificationHistoryPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const fetchNotifications = async () => {
    if (!user) return;
    setIsLoading(true);

    let query = supabase
      .from("notification_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (channelFilter !== "all") {
      query = query.eq("channel", channelFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notification history:", error);
    } else {
      setNotifications((data as NotificationRecord[]) || []);
    }
    setIsLoading(false);
  };

  const handleRetry = async (notificationId: string) => {
    setRetryingIds(prev => new Set(prev).add(notificationId));

    try {
      const { data, error } = await supabase.functions.invoke("retry-notification", {
        body: { notification_id: notificationId },
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast({
          title: "Notification Retried",
          description: "The notification was successfully resent.",
        });
        fetchNotifications();
      } else {
        toast({
          title: "Retry Failed",
          description: data?.error || "Failed to retry the notification.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error retrying notification:", error);
      toast({
        title: "Retry Failed",
        description: "An error occurred while retrying the notification.",
        variant: "destructive",
      });
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, channelFilter]);

  const groupedByDate = notifications.reduce(
    (acc, notification) => {
      const date = format(new Date(notification.created_at), "yyyy-MM-dd");
      if (!acc[date]) acc[date] = [];
      acc[date].push(notification);
      return acc;
    },
    {} as Record<string, NotificationRecord[]>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-muted-foreground">
            View all notifications sent to you across all channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="push">Push</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="in_app">In-App</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground/70">
              Notifications will appear here once they are sent
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </h3>
              <div className="space-y-3">
                {items.map((notification) => {
                  const ChannelIcon = channelIcons[notification.channel];
                  const statusInfo = statusConfig[notification.status];
                  const StatusIcon = statusInfo.icon;
                  const isRetrying = retryingIds.has(notification.id);

                  return (
                    <Card key={notification.id}>
                      <CardContent className="flex items-start gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          <ChannelIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium">{notification.title}</p>
                              {notification.body && (
                                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                  {notification.body}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {channelLabels[notification.channel]}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`${statusInfo.color} text-white`}
                              >
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
                              {notification.status === "failed" && notification.channel !== "in_app" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRetry(notification.id)}
                                  disabled={isRetrying}
                                  className="h-7 px-2"
                                >
                                  <RotateCcw className={`h-3 w-3 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
                                  {isRetrying ? "Retrying..." : "Retry"}
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(notification.created_at), "h:mm a")}
                            </span>
                            <span className="capitalize">
                              {notification.notification_type.replace(/_/g, " ")}
                            </span>
                          </div>
                          {notification.error_message && (
                            <p className="mt-2 text-sm text-destructive">
                              Error: {notification.error_message}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
