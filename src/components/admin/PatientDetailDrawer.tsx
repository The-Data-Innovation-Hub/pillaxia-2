import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Pill,
  Bell,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Target,
  Heart,
} from "lucide-react";
import { ClinicianEncouragementDialog } from "./ClinicianEncouragementDialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";

interface PatientInfo {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  currentScore: {
    overall_score: number;
    adherence_score: number;
    app_usage_score: number;
    notification_score: number;
    risk_level: string;
    score_date: string;
    metrics: {
      adherence?: { taken: number; missed: number; total: number; rate: number };
      appUsage?: { logins: number; pageViews: number; actionsPerformed: number };
      notifications?: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number };
    };
  };
}

interface PatientDetailDrawerProps {
  patient: PatientInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoricalScore {
  date: string;
  overall: number;
  adherence: number;
  appUsage: number;
  notifications: number;
}

export function PatientDetailDrawer({ patient, open, onOpenChange }: PatientDetailDrawerProps) {
  const [encouragementOpen, setEncouragementOpen] = useState(false);

  // Fetch historical scores for this patient
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["patient-engagement-history", patient?.user_id],
    queryFn: async () => {
      if (!patient?.user_id) return [];
      
      const startDate = subDays(new Date(), 30);
      const { data, error } = await supabase
        .from("patient_engagement_scores")
        .select("score_date, overall_score, adherence_score, app_usage_score, notification_score")
        .eq("user_id", patient.user_id)
        .gte("score_date", format(startDate, "yyyy-MM-dd"))
        .order("score_date", { ascending: true });

      if (error) throw error;

      return data.map((s) => ({
        date: s.score_date,
        overall: Number(s.overall_score),
        adherence: Number(s.adherence_score),
        appUsage: Number(s.app_usage_score),
        notifications: Number(s.notification_score),
      })) as HistoricalScore[];
    },
    enabled: !!patient?.user_id && open,
  });

  if (!patient) return null;

  const { currentScore } = patient;
  const patientName = `${patient.first_name || "Unknown"} ${patient.last_name || ""}`.trim();

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "[&>div]:bg-green-500";
    if (score >= 60) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-red-500";
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "high":
        return <Badge variant="destructive">High Risk</Badge>;
      case "medium":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Medium Risk</Badge>;
      default:
        return <Badge variant="outline" className="bg-green-50 text-green-700">Low Risk</Badge>;
    }
  };

  // Calculate trend
  const getTrend = () => {
    if (!history || history.length < 2) return { direction: "stable", change: 0 };
    const recent = history.slice(-3);
    const older = history.slice(0, Math.min(3, history.length));
    const recentAvg = recent.reduce((a, b) => a + b.overall, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.overall, 0) / older.length;
    const diff = Math.round(recentAvg - olderAvg);
    if (diff > 5) return { direction: "improving", change: diff };
    if (diff < -5) return { direction: "declining", change: Math.abs(diff) };
    return { direction: "stable", change: 0 };
  };

  const trend = getTrend();

  // Generate actionable insights
  const getInsights = () => {
    const insights: { type: "warning" | "success" | "tip"; message: string }[] = [];

    // Adherence insights
    if (Number(currentScore.adherence_score) < 60) {
      insights.push({
        type: "warning",
        message: `Medication adherence is low (${currentScore.adherence_score}%). Consider scheduling a check-in call to understand barriers.`,
      });
    } else if (Number(currentScore.adherence_score) >= 90) {
      insights.push({
        type: "success",
        message: "Excellent medication adherence! Patient is consistently taking their medications.",
      });
    }

    // App usage insights
    if (Number(currentScore.app_usage_score) < 40) {
      insights.push({
        type: "warning",
        message: "Low app engagement. Patient may benefit from a reminder about app features or assistance with technology.",
      });
    }

    // Notification insights
    if (Number(currentScore.notification_score) < 50) {
      insights.push({
        type: "tip",
        message: "Low notification response rate. Consider adjusting notification timing or switching channels (SMS, WhatsApp).",
      });
    }

    // Trend insights
    if (trend.direction === "declining") {
      insights.push({
        type: "warning",
        message: `Engagement has declined by ${trend.change}% recently. Proactive outreach recommended.`,
      });
    } else if (trend.direction === "improving") {
      insights.push({
        type: "success",
        message: `Great progress! Engagement has improved by ${trend.change}% recently.`,
      });
    }

    // Risk-based insights
    if (currentScore.risk_level === "high") {
      insights.push({
        type: "warning",
        message: "High-risk patient requires immediate attention and care coordination.",
      });
    }

    // Add default tip if no warnings
    if (insights.filter((i) => i.type === "warning").length === 0) {
      insights.push({
        type: "tip",
        message: "Continue monitoring and maintain regular engagement to sustain positive outcomes.",
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-xl">{patientName}</SheetTitle>
                {getRiskBadge(currentScore.risk_level)}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setEncouragementOpen(true)}
              >
                <Heart className="h-4 w-4" />
                Send Encouragement
              </Button>
            </div>
            <SheetDescription>{patient.email}</SheetDescription>
          </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Overall Score Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Score</p>
                      <p className={`text-3xl font-bold ${getScoreColor(Number(currentScore.overall_score))}`}>
                        {currentScore.overall_score}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      {trend.direction === "improving" && (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">+{trend.change}%</span>
                        </>
                      )}
                      {trend.direction === "declining" && (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-600">-{trend.change}%</span>
                        </>
                      )}
                      {trend.direction === "stable" && (
                        <>
                          <Minus className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Stable</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {format(new Date(currentScore.score_date), "MMM d")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score Breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Score Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Adherence */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Medication Adherence</span>
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(Number(currentScore.adherence_score))}`}>
                      {currentScore.adherence_score}%
                    </span>
                  </div>
                  <Progress
                    value={Number(currentScore.adherence_score)}
                    className={`h-2 ${getProgressColor(Number(currentScore.adherence_score))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {currentScore.metrics?.adherence?.taken || 0} of {currentScore.metrics?.adherence?.total || 0} doses taken
                    {currentScore.metrics?.adherence?.missed > 0 && (
                      <span className="text-red-600"> • {currentScore.metrics.adherence.missed} missed</span>
                    )}
                  </p>
                </div>

                <Separator />

                {/* App Usage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">App Engagement</span>
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(Number(currentScore.app_usage_score))}`}>
                      {currentScore.app_usage_score}%
                    </span>
                  </div>
                  <Progress
                    value={Number(currentScore.app_usage_score)}
                    className={`h-2 ${getProgressColor(Number(currentScore.app_usage_score))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {currentScore.metrics?.appUsage?.logins || 0} logins • {currentScore.metrics?.appUsage?.pageViews || 0} page views
                  </p>
                </div>

                <Separator />

                {/* Notifications */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Notification Response</span>
                    </div>
                    <span className={`text-sm font-bold ${getScoreColor(Number(currentScore.notification_score))}`}>
                      {currentScore.notification_score}%
                    </span>
                  </div>
                  <Progress
                    value={Number(currentScore.notification_score)}
                    className={`h-2 ${getProgressColor(Number(currentScore.notification_score))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {currentScore.metrics?.notifications?.opened || 0} of {currentScore.metrics?.notifications?.sent || 0} opened
                    {" • "}
                    {currentScore.metrics?.notifications?.clickRate?.toFixed(0) || 0}% click rate
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Engagement History Chart */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  30-Day History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : !history || history.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                    No historical data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(new Date(v), "M/d")}
                        className="text-xs"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
                      <Tooltip
                        labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                        formatter={(value: number) => [`${value}%`]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="overall"
                        name="Overall"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="adherence"
                        name="Adherence"
                        stroke="#22C55E"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 2"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Actionable Insights */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Actionable Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 p-3 rounded-lg ${
                      insight.type === "warning"
                        ? "bg-red-50 border border-red-100"
                        : insight.type === "success"
                        ? "bg-green-50 border border-green-100"
                        : "bg-muted/50 border border-muted"
                    }`}
                  >
                    {insight.type === "warning" && <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
                    {insight.type === "success" && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />}
                    {insight.type === "tip" && <Lightbulb className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />}
                    <p className="text-sm">{insight.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        </SheetContent>
      </Sheet>

      <ClinicianEncouragementDialog
        open={encouragementOpen}
        onOpenChange={setEncouragementOpen}
        patientUserId={patient.user_id}
        patientName={patientName}
      />
    </>
  );
}
