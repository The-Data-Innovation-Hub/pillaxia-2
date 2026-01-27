import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { TrendingUp, BarChart3, Activity } from "lucide-react";
import type { CachedSymptomEntry } from "@/lib/cache";

interface SymptomTrendsChartProps {
  symptoms: CachedSymptomEntry[];
}

const SYMPTOM_COLORS: Record<string, string> = {
  Headache: "hsl(var(--chart-1))",
  Nausea: "hsl(var(--chart-2))",
  Fatigue: "hsl(var(--chart-3))",
  Dizziness: "hsl(var(--chart-4))",
  Pain: "hsl(var(--chart-5))",
  "Stomach Issues": "hsl(var(--chart-1))",
  Anxiety: "hsl(var(--chart-2))",
  "Sleep Issues": "hsl(var(--chart-3))",
  Other: "hsl(var(--chart-4))",
};

const getSeverityColor = (severity: number) => {
  if (severity <= 2) return "hsl(142, 76%, 36%)"; // green
  if (severity <= 4) return "hsl(48, 96%, 53%)"; // yellow
  if (severity <= 6) return "hsl(25, 95%, 53%)"; // orange
  if (severity <= 8) return "hsl(0, 84%, 60%)"; // red
  return "hsl(0, 72%, 51%)"; // dark red
};

export function SymptomTrendsChart({ symptoms }: SymptomTrendsChartProps) {
  const [timeRange, setTimeRange] = useState<"7" | "14" | "30">("14");

  // Filter symptoms by time range
  const filteredSymptoms = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(timeRange));
    return symptoms.filter((s) => new Date(s.recorded_at) >= cutoff);
  }, [symptoms, timeRange]);

  // Prepare daily severity data
  const dailySeverityData = useMemo(() => {
    const days = parseInt(timeRange);
    const interval = eachDayOfInterval({
      start: subDays(new Date(), days - 1),
      end: new Date(),
    });

    return interval.map((day) => {
      const dayStart = startOfDay(day);
      const daySymptoms = filteredSymptoms.filter((s) => {
        const symptomDate = startOfDay(new Date(s.recorded_at));
        return symptomDate.getTime() === dayStart.getTime();
      });

      const avgSeverity =
        daySymptoms.length > 0
          ? daySymptoms.reduce((sum, s) => sum + s.severity, 0) / daySymptoms.length
          : 0;

      return {
        date: format(day, "MMM d"),
        fullDate: format(day, "MMM d, yyyy"),
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        count: daySymptoms.length,
      };
    });
  }, [filteredSymptoms, timeRange]);

  // Prepare symptom type frequency data
  const symptomTypeData = useMemo(() => {
    const typeCounts: Record<string, { count: number; avgSeverity: number; total: number }> = {};

    filteredSymptoms.forEach((s) => {
      if (!typeCounts[s.symptom_type]) {
        typeCounts[s.symptom_type] = { count: 0, avgSeverity: 0, total: 0 };
      }
      typeCounts[s.symptom_type].count++;
      typeCounts[s.symptom_type].total += s.severity;
    });

    return Object.entries(typeCounts)
      .map(([type, data]) => ({
        type,
        count: data.count,
        avgSeverity: Math.round((data.total / data.count) * 10) / 10,
        fill: SYMPTOM_COLORS[type] || "hsl(var(--chart-5))",
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredSymptoms]);

  // Summary stats
  const stats = useMemo(() => {
    if (filteredSymptoms.length === 0) {
      return { total: 0, avgSeverity: 0, mostCommon: "None" };
    }

    const avgSeverity =
      filteredSymptoms.reduce((sum, s) => sum + s.severity, 0) / filteredSymptoms.length;

    const typeCounts: Record<string, number> = {};
    filteredSymptoms.forEach((s) => {
      typeCounts[s.symptom_type] = (typeCounts[s.symptom_type] || 0) + 1;
    });

    const mostCommon = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    return {
      total: filteredSymptoms.length,
      avgSeverity: Math.round(avgSeverity * 10) / 10,
      mostCommon,
    };
  }, [filteredSymptoms]);

  if (symptoms.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Symptom Trends
          </CardTitle>
          <div className="flex gap-1">
            {(["7", "14", "30"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Entries</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-foreground">{stats.avgSeverity}</p>
            <p className="text-xs text-muted-foreground">Avg Severity</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold text-foreground truncate">{stats.mostCommon}</p>
            <p className="text-xs text-muted-foreground">Most Common</p>
          </div>
        </div>

        <Tabs defaultValue="severity" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="severity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Severity Over Time
            </TabsTrigger>
            <TabsTrigger value="frequency" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Frequency by Type
            </TabsTrigger>
          </TabsList>

          <TabsContent value="severity" className="mt-0">
            <div className="h-64">
              {dailySeverityData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySeverityData}>
                    <defs>
                      <linearGradient id="severityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <p className="text-sm font-medium">{data.fullDate}</p>
                              <p className="text-sm text-muted-foreground">
                                Avg Severity: <span className="font-medium">{data.avgSeverity}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Entries: <span className="font-medium">{data.count}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avgSeverity"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#severityGradient)"
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No symptom data in selected time range
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="frequency" className="mt-0">
            <div className="h-64">
              {symptomTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={symptomTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis
                      dataKey="type"
                      type="category"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <p className="text-sm font-medium">{data.type}</p>
                              <p className="text-sm text-muted-foreground">
                                Count: <span className="font-medium">{data.count}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Avg Severity: <span className="font-medium">{data.avgSeverity}</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {symptomTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSeverityColor(entry.avgSeverity)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No symptom data in selected time range
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Bar color indicates average severity (green = mild, red = severe)
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
