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
  XCircle,
  TrendingUp,
  Clock,
  TestTube,
  Loader2,
  User,
  RotateCcw,
  AlertTriangle,
  Timer,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const CHANNEL_COLORS: Record<string, string> = {
  push: "#8B5CF6",
  email: "#3B82F6",
  whatsapp: "#22C55E",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "#22C55E",
  delivered: "#10B981",
  failed: "#EF4444",
  pending: "#F59E0B",
};

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  push: Smartphone,
  email: Mail,
  whatsapp: MessageSquare,
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
  const endDate = endOfDay(new Date());

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["notification-analytics", timeRange],
    queryFn: async () => {
      const { data: notifications, error } = await supabase
        .from("notification_history")
        .select("channel, status, notification_type, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Aggregate by channel
      const byChannel: Record<string, { sent: number; failed: number; total: number }> = {
        push: { sent: 0, failed: 0, total: 0 },
        email: { sent: 0, failed: 0, total: 0 },
        whatsapp: { sent: 0, failed: 0, total: 0 },
      };

      // Aggregate by status
      const byStatus: Record<string, number> = {
        sent: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
      };

      // Aggregate by notification type
      const byType: Record<string, number> = {};

      // Aggregate by day for trend chart
      const byDay: Record<string, { date: string; sent: number; failed: number }> = {};

      notifications?.forEach((n) => {
        // By channel
        if (byChannel[n.channel]) {
          byChannel[n.channel].total++;
          if (n.status === "sent" || n.status === "delivered") {
            byChannel[n.channel].sent++;
          } else if (n.status === "failed") {
            byChannel[n.channel].failed++;
          }
        }

        // By status
        if (n.status in byStatus) {
          byStatus[n.status]++;
        }

        // By type
        byType[n.notification_type] = (byType[n.notification_type] || 0) + 1;

        // By day
        const day = format(new Date(n.created_at), "yyyy-MM-dd");
        if (!byDay[day]) {
          byDay[day] = { date: day, sent: 0, failed: 0 };
        }
        if (n.status === "sent" || n.status === "delivered") {
          byDay[day].sent++;
        } else if (n.status === "failed") {
          byDay[day].failed++;
        }
      });

      // Fill in missing days
      const trendData = [];
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
        trendData.push(byDay[date] || { date, sent: 0, failed: 0 });
      }

      // Calculate success rates
      const channelData = Object.entries(byChannel).map(([channel, stats]) => ({
        channel,
        ...stats,
        successRate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : "0.0",
      }));

      const statusData = Object.entries(byStatus)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({ name: status, value: count }));

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

      return {
        channelData,
        statusData,
        typeData,
        trendData,
        totalNotifications,
        totalSent,
        totalFailed,
        overallSuccessRate,
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
        // Refresh both queries
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

  const overviewCards = [
    {
      title: "Total Notifications",
      value: analytics?.totalNotifications || 0,
      icon: Bell,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Successfully Sent",
      value: analytics?.totalSent || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Failed",
      value: analytics?.totalFailed || 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Success Rate",
      value: `${analytics?.overallSuccessRate || 0}%`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

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

      // Handle edge function errors (network/invocation issues)
      if (error) {
        throw new Error(error.message || "Failed to connect to email service");
      }

      // Handle application-level errors returned by the function
      if (data?.error) {
        const errorDetails = data.details || data.error;
        let userMessage = errorDetails;
        
        // Provide helpful context for common Resend errors
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
            Delivery statistics across all channels
          </p>
        </div>
        <div className="flex items-center gap-3">
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
                  Send a test email to verify the Resend webhook integration. After sending, check the notification history to see real-time status updates (sent → delivered).
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

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{card.value}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivery Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Delivery Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={analytics?.trendData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(v) => format(new Date(v), "MMM d")}
                />
                <YAxis />
                <RechartsTooltip 
                  labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  name="Sent"
                  stroke="#22C55E" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="failed" 
                  name="Failed"
                  stroke="#EF4444" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Channel Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-4">
                {analytics?.channelData.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.channel] || Bell;
                  const successRate = parseFloat(channel.successRate);
                  return (
                    <div key={channel.channel} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon 
                            className="h-4 w-4" 
                            style={{ color: CHANNEL_COLORS[channel.channel] }}
                          />
                          <span className="font-medium capitalize">
                            {channel.channel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <Badge variant="outline" className="text-green-600">
                            {channel.sent} sent
                          </Badge>
                          <Badge variant="outline" className="text-red-600">
                            {channel.failed} failed
                          </Badge>
                          <span className="font-semibold">
                            {channel.successRate}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${successRate}%`,
                            backgroundColor: 
                              successRate >= 90 ? "#22C55E" :
                              successRate >= 70 ? "#F59E0B" : "#EF4444",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!analytics?.channelData.some((c) => c.total > 0) && (
                  <div className="h-32 flex items-center justify-center text-muted-foreground">
                    No notification data in this period
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : analytics?.statusData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    dataKey="value"
                  >
                    {analytics.statusData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.name] || "#8884d8"}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No notification data in this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : analytics?.typeData.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.typeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150}
                  tick={{ fontSize: 12 }}
                />
                <RechartsTooltip />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">
              No notification data in this period
            </div>
          )}
        </CardContent>
      </Card>

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
