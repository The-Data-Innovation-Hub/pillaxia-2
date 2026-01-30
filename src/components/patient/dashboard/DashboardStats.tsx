/**
 * Dashboard statistics cards component.
 * Displays medication count, progress, adherence rate, and symptoms.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pill, Calendar, TrendingUp, ClipboardList, CloudOff, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardStatsProps {
  stats: {
    totalMedications: number;
    todaysDoses: number;
    takenDoses: number;
    adherenceRate: number;
    recentSymptoms: number;
  };
  isFromCache: boolean;
  isOnline: boolean;
  onRefresh: () => void;
}

export function DashboardStats({ 
  stats, 
  isFromCache, 
  isOnline, 
  onRefresh 
}: DashboardStatsProps) {
  const navigate = useNavigate();

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      role="region"
      aria-label="Dashboard statistics"
    >
      {/* Active Medications */}
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow" 
        onClick={() => navigate("/dashboard/medications")}
        role="button"
        tabIndex={0}
        aria-label={`Active medications: ${stats.totalMedications}`}
        onKeyDown={(e) => e.key === "Enter" && navigate("/dashboard/medications")}
      >
        <CardHeader className="flex flex-col items-center justify-center pb-2">
          <Pill className="h-5 w-5 text-muted-foreground mb-1" aria-hidden="true" />
          <CardTitle className="text-sm font-bold text-center">
            Active Medications
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-2xl font-bold">{stats.totalMedications}</div>
          <p className="text-xs text-muted-foreground">medications being tracked</p>
        </CardContent>
      </Card>

      {/* Today's Progress */}
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow" 
        onClick={() => navigate("/dashboard/schedule")}
        role="button"
        tabIndex={0}
        aria-label={`Today's progress: ${stats.takenDoses} of ${stats.todaysDoses} doses taken`}
        onKeyDown={(e) => e.key === "Enter" && navigate("/dashboard/schedule")}
      >
        <CardHeader className="flex flex-col items-center justify-center pb-2">
          {isFromCache && !isOnline ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mb-1"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              aria-label="Refresh schedule"
            >
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
            </Button>
          ) : (
            <Calendar className="h-5 w-5 text-muted-foreground mb-1" aria-hidden="true" />
          )}
          <CardTitle className="text-sm font-bold text-center flex items-center gap-1.5">
            Today's Progress
            {isFromCache && !isOnline && (
              <CloudOff className="h-3 w-3 text-warning" aria-label="Showing cached data" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-2xl font-bold">
            {stats.takenDoses}/{stats.todaysDoses}
          </div>
          <Progress 
            value={stats.adherenceRate} 
            className="mt-2" 
            aria-label={`${stats.adherenceRate}% complete`}
          />
          {isFromCache && !isOnline && (
            <p className="text-xs text-warning mt-1">Cached data</p>
          )}
        </CardContent>
      </Card>

      {/* Adherence Rate */}
      <Card role="region" aria-label={`Adherence rate: ${stats.adherenceRate}%`}>
        <CardHeader className="flex flex-col items-center justify-center pb-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground mb-1" aria-hidden="true" />
          <CardTitle className="text-sm font-bold text-center">
            Adherence Rate
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-2xl font-bold text-primary">{stats.adherenceRate}%</div>
          <p className="text-xs text-muted-foreground">today's completion</p>
        </CardContent>
      </Card>

      {/* Symptoms Logged */}
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow" 
        onClick={() => navigate("/dashboard/symptoms")}
        role="button"
        tabIndex={0}
        aria-label={`Symptoms logged: ${stats.recentSymptoms} in the last 7 days`}
        onKeyDown={(e) => e.key === "Enter" && navigate("/dashboard/symptoms")}
      >
        <CardHeader className="flex flex-col items-center justify-center pb-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground mb-1" aria-hidden="true" />
          <CardTitle className="text-sm font-bold text-center">
            Symptoms Logged
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-2xl font-bold">{stats.recentSymptoms}</div>
          <p className="text-xs text-muted-foreground">in the last 7 days</p>
        </CardContent>
      </Card>
    </div>
  );
}
