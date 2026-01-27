import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

  const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
  const startDate = startOfDay(subDays(new Date(), days - 1));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Analytics</h1>
          <p className="text-muted-foreground">
            Delivery statistics across all channels
          </p>
        </div>
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
                <Tooltip 
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
                  <Tooltip />
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
                <Tooltip />
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
    </div>
  );
}
