import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
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
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format, subDays } from "date-fns";

interface TrendDataPoint {
  date: string;
  overall: number;
  adherence: number;
  appUsage: number;
  notifications: number;
}

interface PatientOption {
  user_id: string;
  name: string;
  email: string;
  currentRisk: string;
}

export function EngagementTrendsChart() {
  const [selectedPatient, setSelectedPatient] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");

  // Fetch all patients with scores for the selector
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["engagement-patients"],
    queryFn: async () => {
      const { data: scores, error: scoresError } = await db
        .from("patient_engagement_scores")
        .select("user_id, risk_level, score_date")
        .order("score_date", { ascending: false });

      if (scoresError) throw scoresError;

      // Get unique user_ids with their latest risk level
      const latestByUser = new Map<string, { risk_level: string }>();
      scores?.forEach((s) => {
        if (!latestByUser.has(s.user_id)) {
          latestByUser.set(s.user_id, { risk_level: s.risk_level });
        }
      });

      const userIds = Array.from(latestByUser.keys());
      if (userIds.length === 0) return [];

      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const result: PatientOption[] = userIds.map((uid) => {
        const profile = profiles?.find((p) => p.user_id === uid);
        const riskInfo = latestByUser.get(uid);
        return {
          user_id: uid,
          name: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown" : "Unknown",
          email: profile?.email || "",
          currentRisk: riskInfo?.risk_level || "low",
        };
      });

      return result;
    },
  });

  // Fetch trend data
  const { data: trendData, isLoading: trendsLoading } = useQuery({
    queryKey: ["engagement-trends", selectedPatient, dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));

      let query = db
        .from("patient_engagement_scores")
        .select("user_id, score_date, overall_score, adherence_score, app_usage_score, notification_score")
        .gte("score_date", format(startDate, "yyyy-MM-dd"))
        .order("score_date", { ascending: true });

      if (selectedPatient !== "all") {
        query = query.eq("user_id", selectedPatient);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by date and average if showing all patients
      const dateMap = new Map<string, { overall: number[]; adherence: number[]; appUsage: number[]; notifications: number[] }>();

      data?.forEach((record) => {
        const date = record.score_date;
        if (!dateMap.has(date)) {
          dateMap.set(date, { overall: [], adherence: [], appUsage: [], notifications: [] });
        }
        const entry = dateMap.get(date)!;
        entry.overall.push(Number(record.overall_score));
        entry.adherence.push(Number(record.adherence_score));
        entry.appUsage.push(Number(record.app_usage_score));
        entry.notifications.push(Number(record.notification_score));
      });

      const result: TrendDataPoint[] = Array.from(dateMap.entries())
        .map(([date, values]) => ({
          date,
          overall: Math.round(values.overall.reduce((a, b) => a + b, 0) / values.overall.length),
          adherence: Math.round(values.adherence.reduce((a, b) => a + b, 0) / values.adherence.length),
          appUsage: Math.round(values.appUsage.reduce((a, b) => a + b, 0) / values.appUsage.length),
          notifications: Math.round(values.notifications.reduce((a, b) => a + b, 0) / values.notifications.length),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return result;
    },
  });

  // Calculate trend direction
  const getTrendDirection = () => {
    if (!trendData || trendData.length < 2) return "stable";
    const recent = trendData.slice(-3);
    const older = trendData.slice(0, 3);
    const recentAvg = recent.reduce((a, b) => a + b.overall, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.overall, 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 5) return "improving";
    if (diff < -5) return "declining";
    return "stable";
  };

  const trendDirection = getTrendDirection();

  const isLoading = patientsLoading || trendsLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Engagement Trends
            </CardTitle>
            {trendData && trendData.length >= 2 && (
              <Badge
                variant="outline"
                className={
                  trendDirection === "improving"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : trendDirection === "declining"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-muted text-muted-foreground"
                }
              >
                {trendDirection === "improving" && <TrendingUp className="h-3 w-3 mr-1" />}
                {trendDirection === "declining" && <TrendingDown className="h-3 w-3 mr-1" />}
                {trendDirection === "stable" && <Minus className="h-3 w-3 mr-1" />}
                {trendDirection.charAt(0).toUpperCase() + trendDirection.slice(1)}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients (Average)</SelectItem>
                {patients?.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.currentRisk === "high" && (
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : !trendData || trendData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No trend data available for the selected period.</p>
              <p className="text-sm">Calculate engagement scores to see trends.</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(new Date(v), "MMM d")}
                className="text-xs"
              />
              <YAxis domain={[0, 100]} className="text-xs" />
              <Tooltip
                labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                formatter={(value: number, name: string) => [`${value}%`, name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="overall"
                name="Overall"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="adherence"
                name="Adherence"
                stroke="#22C55E"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="appUsage"
                name="App Usage"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="notifications"
                name="Notifications"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
