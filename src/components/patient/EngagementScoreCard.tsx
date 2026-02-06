import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Pill, Bell, MousePointerClick, TrendingUp } from "lucide-react";

export function EngagementScoreCard() {
  const { user } = useAuth();

  const { data: score, isLoading } = useQuery({
    queryKey: ["my-engagement-score", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await db
        .from("patient_engagement_scores")
        .select("*")
        .eq("user_id", user.id)
        .order("score_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getScoreColor = (value: number) => {
    if (value >= 80) return "text-green-600";
    if (value >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (value: number) => {
    if (value >= 80) return "[&>div]:bg-green-500";
    if (value >= 60) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-red-500";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!score) {
    return null; // Don't show card if no score calculated yet
  }

  const adherence = Number(score.adherence_score);
  const appUsage = Number(score.app_usage_score);
  const notifications = Number(score.notification_score);
  const overall = Number(score.overall_score);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Your Engagement Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Overall Score</span>
          </div>
          <p className={`text-4xl font-bold ${getScoreColor(overall)}`}>{overall}%</p>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-muted-foreground" />
                <span>Medication Adherence</span>
              </div>
              <span className={`font-medium ${getScoreColor(adherence)}`}>{adherence}%</span>
            </div>
            <Progress value={adherence} className={`h-2 ${getProgressColor(adherence)}`} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                <span>App Engagement</span>
              </div>
              <span className={`font-medium ${getScoreColor(appUsage)}`}>{appUsage}%</span>
            </div>
            <Progress value={appUsage} className={`h-2 ${getProgressColor(appUsage)}`} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span>Notification Response</span>
              </div>
              <span className={`font-medium ${getScoreColor(notifications)}`}>{notifications}%</span>
            </div>
            <Progress value={notifications} className={`h-2 ${getProgressColor(notifications)}`} />
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Keep taking your medications and staying active to improve your score!
        </p>
      </CardContent>
    </Card>
  );
}
