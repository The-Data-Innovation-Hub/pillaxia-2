import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Pill,
  Calendar,
  Activity,
  TrendingUp,
  CheckCircle,
  XCircle,
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
} from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

export function SystemAnalyticsPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["system-analytics"],
    queryFn: async () => {
      // Get medication logs stats
      const { data: logs } = await supabase
        .from("medication_logs")
        .select("status, created_at");

      const logStats = {
        taken: 0,
        missed: 0,
        pending: 0,
        skipped: 0,
      };

      logs?.forEach((log) => {
        if (log.status in logStats) {
          logStats[log.status as keyof typeof logStats]++;
        }
      });

      const total = logs?.length || 0;
      const adherenceRate = total > 0 ? (logStats.taken / total) * 100 : 0;

      // Get symptom entries
      const { count: symptomCount } = await supabase
        .from("symptom_entries")
        .select("*", { count: "exact", head: true });

      // Get medications by form
      const { data: medications } = await supabase
        .from("medications")
        .select("form");

      const formCounts: Record<string, number> = {};
      medications?.forEach((med) => {
        formCounts[med.form] = (formCounts[med.form] || 0) + 1;
      });

      const medicationsByForm = Object.entries(formCounts).map(([name, value]) => ({
        name,
        value,
      }));

      // Get user activity by role
      const { data: roles } = await supabase.from("user_roles").select("role");

      const roleActivity = {
        patient: 0,
        clinician: 0,
        pharmacist: 0,
        admin: 0,
      };

      roles?.forEach((r) => {
        if (r.role in roleActivity) {
          roleActivity[r.role as keyof typeof roleActivity]++;
        }
      });

      const roleData = Object.entries(roleActivity).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
      }));

      return {
        logStats,
        adherenceRate,
        totalLogs: total,
        symptomCount: symptomCount || 0,
        medicationsByForm,
        roleData,
      };
    },
  });

  const adherenceCards = [
    {
      title: "Doses Taken",
      value: analytics?.logStats.taken || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Doses Missed",
      value: analytics?.logStats.missed || 0,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Pending",
      value: analytics?.logStats.pending || 0,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Skipped",
      value: analytics?.logStats.skipped || 0,
      icon: Activity,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Analytics</h1>
        <p className="text-muted-foreground">Platform-wide statistics and trends</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adherenceCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <CardTitle className="text-sm">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-12 mx-auto" />
              ) : (
                <p className="text-2xl font-bold">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Adherence Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall Adherence Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {analytics?.totalLogs || 0} total medication logs
                </span>
                <span className="text-2xl font-bold">
                  {(analytics?.adherenceRate || 0).toFixed(1)}%
                </span>
              </div>
              <Progress
                value={analytics?.adherenceRate || 0}
                className={`h-3 ${
                  (analytics?.adherenceRate || 0) >= 80
                    ? "[&>div]:bg-green-500"
                    : (analytics?.adherenceRate || 0) >= 60
                    ? "[&>div]:bg-amber-500"
                    : "[&>div]:bg-red-500"
                }`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users by Role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users by Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics?.roleData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Medications by Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Medications by Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : analytics?.medicationsByForm?.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analytics.medicationsByForm}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.medicationsByForm.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No medication data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-purple-50">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-sm">Symptom Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mx-auto" />
            ) : (
              <p className="text-2xl font-bold">{analytics?.symptomCount || 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-sm">Total Logs Recorded</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-12 mx-auto" />
            ) : (
              <p className="text-2xl font-bold">{analytics?.totalLogs || 0}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
