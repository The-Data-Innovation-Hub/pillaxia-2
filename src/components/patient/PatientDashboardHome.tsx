/**
 * Patient Dashboard Home - Main dashboard view for patients.
 * Refactored to use smaller, focused sub-components for maintainability.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Dashboard sub-components
import { DashboardStats, QuickActions, WelcomeSection, SetupPrompt } from "./dashboard";

// Feature components
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

// Hooks
import { useCachedTodaysSchedule } from "@/hooks/useCachedTodaysSchedule";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

interface DashboardStats {
  totalMedications: number;
  todaysDoses: number;
  takenDoses: number;
  adherenceRate: number;
  recentSymptoms: number;
}

export function PatientDashboardHome() {
  const { user, profile } = useAuth();
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
      if (!user) return true;
      const { data, error } = await supabase
        .from("patient_notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Error checking preferences:", error);
        return true;
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

  const handleSyncComplete = async () => {
    await fetchStats();
    await refreshSchedule();
  };

  return (
    <div className="space-y-6" role="main" aria-label="Patient Dashboard">
      {/* Full Onboarding Flow for new users */}
      <OnboardingFlow />

      {/* Notification Setup Wizard (manual trigger) */}
      <NotificationSetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
      />

      {/* Setup Prompt for New Users */}
      {!checkingPrefs && !hasPreferences && (
        <SetupPrompt onSetupClick={() => setShowSetupWizard(true)} />
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
      <WelcomeSection profile={profile} />

      {/* Stats Cards */}
      <DashboardStats
        stats={stats}
        isFromCache={isFromCache}
        isOnline={isOnline}
        onRefresh={refreshSchedule}
      />

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
      <QuickActions />
    </div>
  );
}
