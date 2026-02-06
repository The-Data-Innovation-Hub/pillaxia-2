import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
  Pill,
  Bell,
  MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EngagementTrendsChart } from "./analytics/EngagementTrendsChart";
import { PatientDetailDrawer } from "./PatientDetailDrawer";

interface EngagementScore {
  id: string;
  user_id: string;
  score_date: string;
  adherence_score: number;
  app_usage_score: number;
  notification_score: number;
  overall_score: number;
  risk_level: string;
  metrics: {
    adherence?: { taken: number; missed: number; total: number; rate: number };
    appUsage?: { logins: number; pageViews: number; actionsPerformed: number };
    notifications?: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number };
  };
  profiles?: { first_name: string | null; last_name: string | null; email: string | null } | null;
}

export function PatientEngagementPage() {
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    currentScore: EngagementScore;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: scores, isLoading, refetch } = useQuery({
    queryKey: ["patient-engagement-scores", riskFilter],
    queryFn: async () => {
      // First get engagement scores
      let scoresQuery = db
        .from("patient_engagement_scores")
        .select("*")
        .order("overall_score", { ascending: true });

      if (riskFilter !== "all") {
        scoresQuery = scoresQuery.eq("risk_level", riskFilter);
      }

      const { data: scoresData, error: scoresError } = await scoresQuery;
      if (scoresError) throw scoresError;

      // Then get profiles for all user_ids
      const userIds = [...new Set(scoresData?.map((s) => s.user_id) || [])];
      const { data: profilesData } = await db
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map((p) => [p.user_id, p]));

      // Deduplicate by user_id, keeping only the latest
      const latestScores = new Map<string, EngagementScore>();
      scoresData?.forEach((score) => {
        const existing = latestScores.get(score.user_id);
        if (!existing || new Date(score.score_date) > new Date(existing.score_date)) {
          latestScores.set(score.user_id, {
            ...score,
            metrics: score.metrics as EngagementScore["metrics"],
            profiles: profilesMap.get(score.user_id) || null,
          });
        }
      });

      return Array.from(latestScores.values());
    },
  });

  const calculateScores = async () => {
    setIsCalculating(true);
    try {
      const { data, error } = await db.functions.invoke("calculate-engagement-scores", {
        body: { days: 7 },
      });
      if (error) throw error;
      toast.success(`Calculated scores for ${data.processed} patients`);
      refetch();
    } catch (error) {
      console.error("Error calculating scores:", error);
      toast.error("Failed to calculate engagement scores");
    } finally {
      setIsCalculating(false);
    }
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  // Summary stats
  const highRiskCount = scores?.filter((s) => s.risk_level === "high").length || 0;
  const mediumRiskCount = scores?.filter((s) => s.risk_level === "medium").length || 0;
  const lowRiskCount = scores?.filter((s) => s.risk_level === "low").length || 0;
  const avgScore = scores?.length
    ? Math.round(scores.reduce((acc, s) => acc + Number(s.overall_score), 0) / scores.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patient Engagement</h1>
          <p className="text-muted-foreground">
            Track adherence, app usage, and notification responsiveness
          </p>
        </div>
        <Button onClick={calculateScores} disabled={isCalculating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isCalculating ? "animate-spin" : ""}`} />
          {isCalculating ? "Calculating..." : "Recalculate Scores"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <TrendingDown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Medium Risk</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-bold text-amber-600">{mediumRiskCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Risk</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">{lowRiskCount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Score</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className={`text-2xl font-bold ${getScoreColor(avgScore)}`}>{avgScore}%</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Trends Chart */}
      <EngagementTrendsChart />

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patient Scores
            </CardTitle>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : scores?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No engagement scores yet.</p>
              <p className="text-sm">Click "Recalculate Scores" to generate initial scores.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Pill className="h-4 w-4" />
                      <span>Adherence</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MousePointerClick className="h-4 w-4" />
                      <span>App Usage</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Bell className="h-4 w-4" />
                      <span>Notifications</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Overall</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores?.map((score) => (
                  <TableRow 
                    key={score.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedPatient({
                        user_id: score.user_id,
                        first_name: score.profiles?.first_name || null,
                        last_name: score.profiles?.last_name || null,
                        email: score.profiles?.email || null,
                        currentScore: score,
                      });
                      setDrawerOpen(true);
                    }}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {score.profiles?.first_name || "Unknown"} {score.profiles?.last_name || ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{score.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={Number(score.adherence_score)} className="w-16 h-2" />
                          <span className={`text-sm font-medium ${getScoreColor(Number(score.adherence_score))}`}>
                            {score.adherence_score}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {score.metrics?.adherence?.taken || 0} / {score.metrics?.adherence?.total || 0} taken
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={Number(score.app_usage_score)} className="w-16 h-2" />
                          <span className={`text-sm font-medium ${getScoreColor(Number(score.app_usage_score))}`}>
                            {score.app_usage_score}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {score.metrics?.appUsage?.logins || 0} logins
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={Number(score.notification_score)} className="w-16 h-2" />
                          <span className={`text-sm font-medium ${getScoreColor(Number(score.notification_score))}`}>
                            {score.notification_score}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          {score.metrics?.notifications?.openRate?.toFixed(0) || 0}% open rate
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-lg font-bold ${getScoreColor(Number(score.overall_score))}`}>
                        {score.overall_score}%
                      </span>
                    </TableCell>
                    <TableCell>{getRiskBadge(score.risk_level)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(score.score_date), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Patient Detail Drawer */}
      <PatientDetailDrawer
        patient={selectedPatient}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
