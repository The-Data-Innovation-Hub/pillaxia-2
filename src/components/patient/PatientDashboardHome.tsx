import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pill, Calendar, ClipboardList, TrendingUp, Plus, Bot } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CaregiverInvitationsReceived } from "./CaregiverInvitationsReceived";

interface DashboardStats {
  totalMedications: number;
  todaysDoses: number;
  takenDoses: number;
  adherenceRate: number;
  recentSymptoms: number;
}

export function PatientDashboardHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalMedications: 0,
    todaysDoses: 0,
    takenDoses: 0,
    adherenceRate: 0,
    recentSymptoms: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Get total active medications
      const { count: medCount } = await supabase
        .from("medications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      // Get today's medication logs
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data: todaysLogs } = await supabase
        .from("medication_logs")
        .select("status")
        .eq("user_id", user.id)
        .gte("scheduled_time", startOfDay)
        .lte("scheduled_time", endOfDay);

      const todaysDoses = todaysLogs?.length || 0;
      const takenDoses = todaysLogs?.filter((l) => l.status === "taken").length || 0;

      // Get recent symptoms (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { count: symptomCount } = await supabase
        .from("symptom_entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("recorded_at", weekAgo.toISOString());

      setStats({
        totalMedications: medCount || 0,
        todaysDoses,
        takenDoses,
        adherenceRate: todaysDoses > 0 ? Math.round((takenDoses / todaysDoses) * 100) : 100,
        recentSymptoms: symptomCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      {/* Caregiver Invitations (if any) */}
      <CaregiverInvitationsReceived />

      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting()}, {profile?.first_name || "there"}! 👋
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Button onClick={() => navigate("/dashboard/angela")} className="gap-2">
          <Bot className="h-4 w-4" />
          Ask Angela
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/medications")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Medications
            </CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMedications}</div>
            <p className="text-xs text-muted-foreground">medications being tracked</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/schedule")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Progress
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.takenDoses}/{stats.todaysDoses}
            </div>
            <Progress value={stats.adherenceRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Adherence Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.adherenceRate}%</div>
            <p className="text-xs text-muted-foreground">today's completion</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/dashboard/symptoms")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Symptoms Logged
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentSymptoms}</div>
            <p className="text-xs text-muted-foreground">in the last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/dashboard/medications")}>
              <Plus className="h-5 w-5" />
              <span>Add Medication</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/dashboard/schedule")}>
              <Calendar className="h-5 w-5" />
              <span>View Schedule</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/dashboard/symptoms")}>
              <ClipboardList className="h-5 w-5" />
              <span>Log Symptom</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate("/dashboard/angela")}>
              <Bot className="h-5 w-5" />
              <span>Ask Angela</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
