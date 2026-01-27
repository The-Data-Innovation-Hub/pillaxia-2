import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  TestTube,
  Loader2,
  User,
  RotateCcw,
  AlertTriangle,
  Timer,
  Phone,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  AnalyticsOverviewCards,
  EngagementFunnelChart,
  ChannelEngagementTable,
  DeliveryTrendChart,
  AnalyticsExport,
} from "./analytics";

const CHANNEL_COLORS: Record<string, string> = {
  push: "#8B5CF6",
  email: "#3B82F6",
  whatsapp: "#22C55E",
  sms: "#F59E0B",
};

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  push: Smartphone,
  email: Mail,
  whatsapp: MessageSquare,
  sms: Phone,
};

type TimeRange = "7d" | "14d" | "30d";

export function NotificationAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
  const startDate = startOfDay(subDays(new Date(), days - 1));
  const endDate = endOfDay(new Date());

  // Fetch current admin's email from their profile
  const { data: currentUserProfile } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .maybeSingle();
      
      return profile;
    },
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["notification-analytics", timeRange],
    queryFn: async () => {
      const { data: notifications, error } = await supabase
        .from("notification_history")
        .select("channel, status, notification_type, created_at, delivered_at, opened_at, clicked_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Initialize channel stats with engagement metrics
      const byChannel: Record<string, {
        total: number;
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        failed: number;
      }> = {
        push: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 },
        email: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 },
        whatsapp: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 },
        sms: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 },
      };

      // Aggregate by status
      const byStatus: Record<string, number> = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
        pending: 0,
      };

      // Aggregate by notification type
      const byType: Record<string, number> = {};

      // Aggregate by day for trend chart with engagement data
      const byDay: Record<string, {
        date: string;
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        failed: number;
      }> = {};

      // Total engagement counters
      let totalDelivered = 0;
      let totalOpened = 0;
      let totalClicked = 0;

      notifications?.forEach((n) => {
        const channel = n.channel;
        
        // Initialize channel if not exists
        if (!byChannel[channel]) {
          byChannel[channel] = { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
        }

        byChannel[channel].total++;

        // Count based on status
        if (n.status === "sent" || n.status === "delivered") {
          byChannel[channel].sent++;
          byStatus.sent++;
        } else if (n.status === "failed") {
          byChannel[channel].failed++;
          byStatus.failed++;
        } else if (n.status === "pending") {
          byStatus.pending++;
        }

        // Track delivery timestamps for engagement metrics
        if (n.delivered_at) {
          byChannel[channel].delivered++;
          totalDelivered++;
          byStatus.delivered++;
        }

        if (n.opened_at) {
          byChannel[channel].opened++;
          totalOpened++;
        }

        if (n.clicked_at) {
          byChannel[channel].clicked++;
          totalClicked++;
        }

        // By type
        byType[n.notification_type] = (byType[n.notification_type] || 0) + 1;

        // By day with all metrics
        const day = format(new Date(n.created_at), "yyyy-MM-dd");
        if (!byDay[day]) {
          byDay[day] = { date: day, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
        }

        if (n.status === "sent" || n.status === "delivered") {
          byDay[day].sent++;
        } else if (n.status === "failed") {
          byDay[day].failed++;
        }

        if (n.delivered_at) {
          const deliveredDay = format(new Date(n.delivered_at), "yyyy-MM-dd");
          if (!byDay[deliveredDay]) {
            byDay[deliveredDay] = { date: deliveredDay, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
          }
          byDay[deliveredDay].delivered++;
        }

        if (n.opened_at) {
          const openedDay = format(new Date(n.opened_at), "yyyy-MM-dd");
          if (!byDay[openedDay]) {
            byDay[openedDay] = { date: openedDay, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
          }
          byDay[openedDay].opened++;
        }

        if (n.clicked_at) {
          const clickedDay = format(new Date(n.clicked_at), "yyyy-MM-dd");
          if (!byDay[clickedDay]) {
            byDay[clickedDay] = { date: clickedDay, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
          }
          byDay[clickedDay].clicked++;
        }
      });

      // Fill in missing days
      const trendData = [];
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
        trendData.push(byDay[date] || { date, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 });
      }

      // Calculate channel engagement stats with rates
      const channelStats = Object.entries(byChannel).map(([channel, stats]) => ({
        channel,
        ...stats,
        deliveryRate: stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0.0",
        openRate: stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0.0",
        clickRate: stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0.0",
      }));

      const typeData = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([type, count]) => ({
          name: type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          count,
        }));

      const totalNotifications = notifications?.length || 0;
      const totalSent = byStatus.sent + byStatus.delivered;
      const totalFailed = byStatus.failed;
      const overallSuccessRate = totalNotifications > 0 
        ? ((totalSent / totalNotifications) * 100).toFixed(1) 
        : "0.0";
      
      // Calculate overall engagement rates
      const deliveryRate = totalSent > 0 
        ? ((totalDelivered / totalSent) * 100).toFixed(1) 
        : "0.0";
      const openRate = totalDelivered > 0 
        ? ((totalOpened / totalDelivered) * 100).toFixed(1) 
        : "0.0";
      const clickRate = totalOpened > 0 
        ? ((totalClicked / totalOpened) * 100).toFixed(1) 
        : "0.0";

      return {
        channelStats,
        typeData,
        trendData,
        totalNotifications,
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalFailed,
        overallSuccessRate,
        deliveryRate,
        openRate,
        clickRate,
      };
    },
  });

  // Fetch failed notifications for the retry table
  const { data: failedNotifications, isLoading: isLoadingFailed } = useQuery({
    queryKey: ["failed-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_history")
        .select("id, channel, notification_type, title, body, error_message, created_at, retry_count, max_retries, next_retry_at, last_retry_at, user_id")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const handleRetry = async (notificationId: string) => {
    setRetryingIds(prev => new Set(prev).add(notificationId));

    try {
      const { data, error } = await supabase.functions.invoke("retry-notification", {
        body: { notification_id: notificationId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Notification Retried",
          description: "The notification was successfully resent.",
        });
        queryClient.invalidateQueries({ queryKey: ["failed-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notification-analytics"] });
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

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter an email address to send the test to.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-email-webhook", {
        body: { to: testEmail.trim() },
      });

      if (error) {
        throw new Error(error.message || "Failed to connect to email service");
      }

      if (data?.error) {
        const errorDetails = data.details || data.error;
        let userMessage = errorDetails;
        
        if (errorDetails?.includes("domain")) {
          userMessage = `Domain verification issue: ${errorDetails}. Please verify your domain at resend.com/domains.`;
        } else if (errorDetails?.includes("from")) {
          userMessage = `Invalid sender address: ${errorDetails}. The 'from' address must use a verified domain.`;
        } else if (errorDetails?.includes("rate") || errorDetails?.includes("limit")) {
          userMessage = `Rate limit exceeded: ${errorDetails}. Please wait before sending more emails.`;
        } else if (errorDetails?.includes("API key") || errorDetails?.includes("api_key")) {
          userMessage = `API key issue: ${errorDetails}. Please check your Resend API key configuration.`;
        }
        
        throw new Error(userMessage);
      }

      toast({
        title: "Test email sent!",
        description: `Email sent to ${testEmail}. Check the notification history to see webhook status updates.`,
      });
      setIsTestDialogOpen(false);
      setTestEmail("");
    } catch (error) {
      console.error("Failed to send test email:", error);
      toast({
        title: "Failed to send test email",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Analytics</h1>
          <p className="text-muted-foreground">
            Delivery rates, open rates, and engagement metrics across all channels
          </p>
        </div>
        <div className="flex items-center gap-3">
          {analytics && (
            <AnalyticsExport
              channelStats={analytics.channelStats}
              trendData={analytics.trendData}
              totalNotifications={analytics.totalNotifications}
              totalSent={analytics.totalSent}
              totalDelivered={analytics.totalDelivered}
              totalOpened={analytics.totalOpened}
              totalClicked={analytics.totalClicked}
              totalFailed={analytics.totalFailed}
              timeRange={timeRange}
            />
          )}
          <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <TestTube className="h-4 w-4 mr-2" />
                Test Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Test Email Webhook</DialogTitle>
                <DialogDescription>
                  Send a test email to verify the Resend webhook integration. After sending, check the notification history to see real-time status updates.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="test-email">Recipient Email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="test@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1"
                    />
                    {currentUserProfile?.email && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTestEmail(currentUserProfile.email!)}
                        className="shrink-0"
                        title="Use my email"
                      >
                        <User className="h-4 w-4 mr-1" />
                        My Email
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  <p className="font-medium mb-1">What this tests:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Email delivery via Resend API</li>
                    <li>Webhook signature verification</li>
                    <li>Status updates (sent → delivered/bounced)</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTestDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={sendTestEmail} disabled={isSendingTest}>
                  {isSendingTest && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Test Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Stats with Engagement Metrics */}
      <AnalyticsOverviewCards
        totalNotifications={analytics?.totalNotifications || 0}
        totalSent={analytics?.totalSent || 0}
        totalDelivered={analytics?.totalDelivered || 0}
        totalOpened={analytics?.totalOpened || 0}
        totalClicked={analytics?.totalClicked || 0}
        totalFailed={analytics?.totalFailed || 0}
        overallSuccessRate={analytics?.overallSuccessRate || "0.0"}
        deliveryRate={analytics?.deliveryRate || "0.0"}
        openRate={analytics?.openRate || "0.0"}
        clickRate={analytics?.clickRate || "0.0"}
        isLoading={isLoading}
      />

      {/* Engagement Funnel */}
      <EngagementFunnelChart
        sent={analytics?.totalSent || 0}
        delivered={analytics?.totalDelivered || 0}
        opened={analytics?.totalOpened || 0}
        clicked={analytics?.totalClicked || 0}
        isLoading={isLoading}
      />

      {/* Delivery & Engagement Trend */}
      <DeliveryTrendChart
        data={analytics?.trendData || []}
        isLoading={isLoading}
      />

      {/* Channel Engagement Breakdown */}
      <ChannelEngagementTable
        channelStats={analytics?.channelStats || []}
        isLoading={isLoading}
      />

      {/* Failed Notifications with Retry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Failed Notifications
          </CardTitle>
          <CardDescription>
            View and retry failed notifications. Click "Retry Now" to immediately attempt redelivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingFailed ? (
            <Skeleton className="h-48 w-full" />
          ) : failedNotifications && failedNotifications.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Retry Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedNotifications.map((notification) => {
                    const ChannelIcon = CHANNEL_ICONS[notification.channel] || Bell;
                    const isRetrying = retryingIds.has(notification.id);
                    const isPermanentlyFailed = notification.retry_count >= notification.max_retries && !notification.next_retry_at;

                    return (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ChannelIcon 
                              className="h-4 w-4" 
                              style={{ color: CHANNEL_COLORS[notification.channel] }}
                            />
                            <span className="capitalize text-sm">{notification.channel}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {notification.notification_type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block text-sm">{notification.title}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[300px]">{notification.title}</p>
                                {notification.body && (
                                  <p className="text-muted-foreground mt-1">{notification.body}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block text-sm text-destructive">
                                  {notification.error_message?.slice(0, 50) || "Unknown error"}
                                  {notification.error_message && notification.error_message.length > 50 ? "..." : ""}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[400px] break-words">{notification.error_message}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {notification.retry_count > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                {notification.retry_count}/{notification.max_retries}
                              </Badge>
                            )}
                            {notification.next_retry_at && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs text-primary">
                                      <Timer className="h-3 w-3 mr-1" />
                                      {format(new Date(notification.next_retry_at), "h:mm a")}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Next auto-retry: {format(new Date(notification.next_retry_at), "MMM d, h:mm a")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {isPermanentlyFailed && (
                              <Badge variant="destructive" className="text-xs">
                                Exhausted
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(notification.created_at), "MMM d, h:mm a")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(notification.id)}
                            disabled={isRetrying}
                          >
                            <RotateCcw className={`h-3 w-3 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
                            {isRetrying ? "Retrying..." : "Retry Now"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
              <p>No failed notifications</p>
              <p className="text-sm">All notifications delivered successfully</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
