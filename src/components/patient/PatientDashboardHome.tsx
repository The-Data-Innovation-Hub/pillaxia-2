/**
 * Patient Dashboard Home - Main dashboard view for patients.
 * Refactored to use smaller, focused sub-components for maintainability.
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  getPatientNotificationPreferences,
  listMedications,
  listMedicationLogs,
  listSymptomEntries,
} from "@/integrations/azure/data";

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
      try {
        const data = await getPatientNotificationPreferences(user.id);
        return !!data;
      } catch {
        return true;
      }
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
      const [meds, logs, symptoms] = await Promise.all([
        listMedications(user.id),
        listMedicationLogs(user.id, {
          from: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
          to: new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
        }),
        listSymptomEntries(user.id),
      ]);

      const medCount = (meds || []).filter((m) => m.is_active !== false).length;
      const todaysLogs = logs || [];
      const todaysDoses = todaysLogs.length;
      const takenDoses = todaysLogs.filter((l) => l.status === "taken").length;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const symptomCount = (symptoms || []).filter(
        (s) => new Date((s.recorded_at as string) || 0) >= weekAgo
      ).length;

      setStats({
        totalMedications: medCount,
        todaysDoses,
        takenDoses,
        adherenceRate: todaysDoses > 0 ? Math.round((takenDoses / todaysDoses) * 100) : 100,
        recentSymptoms: symptomCount,
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
