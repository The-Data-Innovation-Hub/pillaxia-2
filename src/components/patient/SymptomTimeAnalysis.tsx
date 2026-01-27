import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Clock, Sun, Sunrise, Sunset, Moon } from "lucide-react";
import type { CachedSymptomEntry } from "@/lib/cache";

interface SymptomTimeAnalysisProps {
  symptoms: CachedSymptomEntry[];
}

interface TimeSlot {
  hour: number;
  label: string;
  count: number;
  avgSeverity: number;
  symptoms: string[];
}

interface TimePeriod {
  name: string;
  icon: React.ReactNode;
  hours: number[];
  count: number;
  avgSeverity: number;
  topSymptoms: { type: string; count: number }[];
}

const getHourLabel = (hour: number): string => {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

const getSeverityColor = (severity: number): string => {
  if (severity <= 3) return "hsl(var(--chart-3))";
  if (severity <= 6) return "hsl(var(--chart-2))";
  return "hsl(var(--chart-1))";
};

const TIME_PERIODS = [
  { name: "Morning", hours: [6, 7, 8, 9, 10, 11], icon: <Sunrise className="h-4 w-4" /> },
  { name: "Afternoon", hours: [12, 13, 14, 15, 16, 17], icon: <Sun className="h-4 w-4" /> },
  { name: "Evening", hours: [18, 19, 20, 21], icon: <Sunset className="h-4 w-4" /> },
  { name: "Night", hours: [22, 23, 0, 1, 2, 3, 4, 5], icon: <Moon className="h-4 w-4" /> },
];

export function SymptomTimeAnalysis({ symptoms }: SymptomTimeAnalysisProps) {
  // Calculate hourly distribution
  const hourlyData = useMemo<TimeSlot[]>(() => {
    const hourMap = new Map<number, { count: number; totalSeverity: number; symptoms: Set<string> }>();

    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { count: 0, totalSeverity: 0, symptoms: new Set() });
    }

    symptoms.forEach((s) => {
      const hour = new Date(s.recorded_at).getHours();
      const data = hourMap.get(hour)!;
      data.count++;
      data.totalSeverity += s.severity;
      data.symptoms.add(s.symptom_type);
    });

    return Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      label: getHourLabel(hour),
      count: data.count,
      avgSeverity: data.count > 0 ? data.totalSeverity / data.count : 0,
      symptoms: Array.from(data.symptoms),
    }));
  }, [symptoms]);

  // Calculate time period summaries
  const periodData = useMemo<TimePeriod[]>(() => {
    return TIME_PERIODS.map((period) => {
      const periodSymptoms = symptoms.filter((s) => {
        const hour = new Date(s.recorded_at).getHours();
        return period.hours.includes(hour);
      });

      const symptomCounts = new Map<string, number>();
      let totalSeverity = 0;

      periodSymptoms.forEach((s) => {
        totalSeverity += s.severity;
        symptomCounts.set(s.symptom_type, (symptomCounts.get(s.symptom_type) || 0) + 1);
      });

      const topSymptoms = Array.from(symptomCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      return {
        name: period.name,
        icon: period.icon,
        hours: period.hours,
        count: periodSymptoms.length,
        avgSeverity: periodSymptoms.length > 0 ? totalSeverity / periodSymptoms.length : 0,
        topSymptoms,
      };
    });
  }, [symptoms]);

  // Find peak times
  const peakAnalysis = useMemo(() => {
    const peakHour = hourlyData.reduce((max, slot) => 
      slot.count > max.count ? slot : max
    , hourlyData[0]);

    const peakPeriod = periodData.reduce((max, period) =>
      period.count > max.count ? period : max
    , periodData[0]);

    const highestSeverityPeriod = periodData
      .filter((p) => p.count > 0)
      .reduce((max, period) =>
        period.avgSeverity > max.avgSeverity ? period : max
      , periodData[0]);

    return { peakHour, peakPeriod, highestSeverityPeriod };
  }, [hourlyData, periodData]);

  if (symptoms.length < 3) {
    return null;
  }

  const hasData = symptoms.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Time of Day Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        {hasData && peakAnalysis.peakHour.count > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Peak Time</p>
              <p className="text-lg font-bold">{peakAnalysis.peakHour.label}</p>
              <p className="text-xs text-muted-foreground">
                {peakAnalysis.peakHour.count} symptom{peakAnalysis.peakHour.count !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Busiest Period</p>
              <p className="text-lg font-bold">{peakAnalysis.peakPeriod.name}</p>
              <p className="text-xs text-muted-foreground">
                {peakAnalysis.peakPeriod.count} symptom{peakAnalysis.peakPeriod.count !== 1 ? "s" : ""}
              </p>
            </div>
            {peakAnalysis.highestSeverityPeriod.count > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">Highest Severity</p>
                <p className="text-lg font-bold">{peakAnalysis.highestSeverityPeriod.name}</p>
                <p className="text-xs text-muted-foreground">
                  Avg: {peakAnalysis.highestSeverityPeriod.avgSeverity.toFixed(1)}/10
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hourly Distribution Chart */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Hourly Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TimeSlot;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <p className="text-sm font-medium">{data.label}</p>
                          <p className="text-sm text-muted-foreground">
                            Count: <span className="font-medium">{data.count}</span>
                          </p>
                          {data.avgSeverity > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Avg Severity: <span className="font-medium">{data.avgSeverity.toFixed(1)}</span>
                            </p>
                          )}
                          {data.symptoms.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {data.symptoms.slice(0, 3).join(", ")}
                              {data.symptoms.length > 3 && ` +${data.symptoms.length - 3}`}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {hourlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.count > 0 ? getSeverityColor(entry.avgSeverity) : "hsl(var(--muted))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Bar color indicates average severity (green = mild, red = severe)
          </p>
        </div>

        {/* Time Period Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Period Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {periodData.map((period) => (
              <div
                key={period.name}
                className={`p-3 rounded-lg border transition-colors ${
                  period.count > 0 ? "bg-card" : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-muted-foreground">{period.icon}</span>
                  <span className="font-medium text-sm">{period.name}</span>
                </div>
                
                {period.count > 0 ? (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-bold">{period.count}</span>
                      <span className="text-xs text-muted-foreground">symptoms</span>
                    </div>
                    <Badge
                      variant={
                        period.avgSeverity <= 3 ? "secondary" :
                        period.avgSeverity <= 6 ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      Avg: {period.avgSeverity.toFixed(1)}
                    </Badge>
                    {period.topSymptoms.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {period.topSymptoms.map((s) => (
                          <p key={s.type} className="text-xs text-muted-foreground truncate">
                            {s.type} ({s.count})
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Analysis based on the time symptoms were recorded. Log symptoms promptly for accurate insights.
        </p>
      </CardContent>
    </Card>
  );
}
