import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pill, Calendar, ClipboardList, TrendingUp, Plus, Bot, CloudOff, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { CaregiverInvitationsReceived } from "./CaregiverInvitationsReceived";
import { PatientMessagesCard } from "./PatientMessagesCard";
import { ClinicianMessagesCard } from "./ClinicianMessagesCard";
import { OfflineSyncIndicator } from "./OfflineSyncIndicator";
import { NotificationChannelsCard } from "./NotificationChannelsCard";
import { NotificationSetupWizard } from "./NotificationSetupWizard";
import { OnboardingFlow } from "./OnboardingFlow";
import { EngagementScoreCard } from "./EngagementScoreCard";
import { AppointmentsCard } from "./AppointmentsCard";
import { PrescriptionStatusCard } from "./PrescriptionStatusCard";
import { NotificationCenterCard } from "./NotificationCenterCard";
import { useCachedTodaysSchedule } from "@/hooks/useCachedTodaysSchedule";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useQuery } from "@tanstack/react-query";

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
  const { isOnline } = useOfflineStatus();
  const { logs: cachedLogs, isFromCache, refresh: refreshSchedule } = useCachedTodaysSchedule();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalMedications: 0,
    todaysDoses: 0,
    takenDoses: 0,
    adherenceRate: 0,
    recentSymptoms: 0,
  });
  const [loading, setLoading] = useState(true);

  // Check if user has notification preferences set up
  const { data: hasPreferences, isLoading: checkingPrefs } = useQuery({
    queryKey: ["check-notification-preferences", user?.id],
    queryFn: async () => {
      if (!user) return true; // Assume set up if no user
      const { data, error } = await supabase
        .from("patient_notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Error checking preferences:", error);
        return true; // Assume set up on error
      }
      return !!data;
    },
    enabled: !!user,
  });

  // Update stats when cached logs change
  useEffect(() => {
    if (cachedLogs.length > 0) {
      const todaysDoses = cachedLogs.length;
      const takenDoses = cachedLogs.filter(l => l.status === "taken").length;
      setStats(prev => ({
        ...prev,
        todaysDoses,
        takenDoses,
        adherenceRate: todaysDoses > 0 ? Math.round((takenDoses / todaysDoses) * 100) : 100,
      }));
    }
  }, [cachedLogs]);

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

  const handleSyncComplete = async () => {
    await fetchStats();
    await refreshSchedule();
  };

  return (
    <div className="space-y-6">
      {/* Full Onboarding Flow for new users */}
      <OnboardingFlow />

      {/* Notification Setup Wizard (manual trigger) */}
      <NotificationSetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
      />

      {/* Setup Prompt for New Users */}
      {!checkingPrefs && !hasPreferences && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Set up your notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Configure how you'd like to receive medication reminders
                </p>
              </div>
            </div>
            <Button onClick={() => setShowSetupWizard(true)}>
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sync Status Indicator */}
      <OfflineSyncIndicator onSyncComplete={handleSyncComplete} />

      {/* Caregiver Invitations (if any) */}
      <CaregiverInvitationsReceived />

      {/* Messages from Caregivers */}
      <PatientMessagesCard />

      {/* Messages from Clinicians */}
      <ClinicianMessagesCard />

      {/* Welcome Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">
            {greeting()}, {profile?.first_name || "there"}! 👋
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Button
          onClick={() => navigate("/dashboard/angela")}
          className="gap-2 w-full sm:w-auto shrink-0"
        >
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Today's Progress
              {isFromCache && !isOnline && (
                <CloudOff className="h-3 w-3 text-warning" />
              )}
            </CardTitle>
            {isFromCache && !isOnline ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  refreshSchedule();
                }}
              >
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              </Button>
            ) : (
              <Calendar className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.takenDoses}/{stats.todaysDoses}
            </div>
            <Progress value={stats.adherenceRate} className="mt-2" />
            {isFromCache && !isOnline && (
              <p className="text-xs text-warning mt-1">Cached data</p>
            )}
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

      {/* Prescription Status */}
      <PrescriptionStatusCard />

      {/* Notification Center */}
      <NotificationCenterCard />

      {/* Appointments and Engagement */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AppointmentsCard />
        <EngagementScoreCard />
      </div>

      {/* Notification Channels Summary */}
      <NotificationChannelsCard />

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
