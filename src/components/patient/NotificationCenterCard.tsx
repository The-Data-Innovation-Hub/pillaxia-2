import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone, 
  Send,
  Check,
  X,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  channel: string;
  notification_type: string;
  title: string;
  body: string | null;
  status: string;
  created_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  metadata: Record<string, unknown> | null;
}

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  push: <Smartphone className="h-4 w-4" />,
  whatsapp: <Send className="h-4 w-4" />,
};

const channelLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  whatsapp: "WhatsApp",
};

const statusColors: Record<string, string> = {
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

const statusIcons: Record<string, React.ReactNode> = {
  sent: <Clock className="h-3 w-3" />,
  delivered: <Check className="h-3 w-3" />,
  failed: <X className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
};

export function NotificationCenterCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notification-center", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await db
        .from("notification_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }

      return data as Notification[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const filteredNotifications = notifications?.filter(n => 
    selectedChannel === "all" || n.channel === selectedChannel
  ) || [];

  const channelCounts = notifications?.reduce((acc, n) => {
    acc[n.channel] = (acc[n.channel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const getNotificationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      medication_reminder: "Medication Reminder",
      missed_dose: "Missed Dose Alert",
      refill_request: "Refill Update",
      encouragement_message: "Encouragement",
      clinician_message: "Clinician Message",
      appointment_reminder: "Appointment",
      prescription_update: "Prescription Update",
    };
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Notification Center</CardTitle>
          {notifications && notifications.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {notifications.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/dashboard/notifications")}
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedChannel} onValueChange={setSelectedChannel}>
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="all" className="text-xs">
              All
              {notifications && notifications.length > 0 && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              {channelCounts.email || 0}
            </TabsTrigger>
            <TabsTrigger value="sms" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              {channelCounts.sms || 0}
            </TabsTrigger>
            <TabsTrigger value="push" className="text-xs">
              <Smartphone className="h-3 w-3 mr-1" />
              {channelCounts.push || 0}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs">
              <Send className="h-3 w-3 mr-1" />
              {channelCounts.whatsapp || 0}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedChannel} className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">
                  {selectedChannel === "all" 
                    ? "Your notification history will appear here"
                    : `No ${channelLabels[selectedChannel]} notifications`
                  }
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {channelIcons[notification.channel] || <Bell className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {notification.title}
                            </p>
                            {notification.body && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {notification.body}
                              </p>
                            )}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`flex-shrink-0 text-[10px] ${statusColors[notification.status] || ''}`}
                          >
                            {statusIcons[notification.status]}
                            <span className="ml-1 capitalize">{notification.status}</span>
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {getNotificationTypeLabel(notification.notification_type)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
