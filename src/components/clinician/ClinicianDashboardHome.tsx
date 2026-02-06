import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Pill, Activity, AlertTriangle, FileText, CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RedFlagAlertsCard } from "./RedFlagAlertsCard";
import { PolypharmacyWarningsCard } from "./PolypharmacyWarningsCard";
import { PatientRiskFlagsCard } from "./PatientRiskFlagsCard";
import { useLanguage } from "@/i18n/LanguageContext";

export function ClinicianDashboardHome() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["clinician-stats", user?.id],
    queryFn: async () => {
      // Get assigned patients count
      const { count: patientCount } = await db
        .from("clinician_patient_assignments")
        .select("*", { count: "exact", head: true })
        .eq("clinician_user_id", user!.id);

      // Get patients with their medication data
      const { data: assignments } = await db
        .from("clinician_patient_assignments")
        .select("patient_user_id")
        .eq("clinician_user_id", user!.id);

      const patientIds = assignments?.map((a) => a.patient_user_id) || [];

      let activeMedications = 0;
      let lowAdherenceCount = 0;

      if (patientIds.length > 0) {
        // Get active medications for assigned patients
        const { count: medCount } = await db
          .from("medications")
          .select("*", { count: "exact", head: true })
          .in("user_id", patientIds)
          .eq("is_active", true);

        activeMedications = medCount || 0;

        // Get adherence data (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: logs } = await db
          .from("medication_logs")
          .select("user_id, status")
          .in("user_id", patientIds)
          .gte("scheduled_time", sevenDaysAgo.toISOString());

        // Calculate patients with <80% adherence
        const patientAdherence: Record<string, { taken: number; total: number }> = {};
        logs?.forEach((log) => {
          if (!patientAdherence[log.user_id]) {
            patientAdherence[log.user_id] = { taken: 0, total: 0 };
          }
          patientAdherence[log.user_id].total++;
          if (log.status === "taken") {
            patientAdherence[log.user_id].taken++;
          }
        });

        lowAdherenceCount = Object.values(patientAdherence).filter(
          (p) => p.total > 0 && p.taken / p.total < 0.8
        ).length;
      }

      return {
        patientCount: patientCount || 0,
        activeMedications,
        lowAdherenceCount,
      };
    },
    enabled: !!user,
  });

  const statCards = [
    {
      title: t.clinician.assignedPatients,
      value: stats?.patientCount || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/dashboard/patients",
    },
    {
      title: t.clinician.activeMedications,
      value: stats?.activeMedications || 0,
      icon: Pill,
      color: "text-green-600",
      bgColor: "bg-green-50",
      link: "/dashboard/medications",
    },
    {
      title: t.clinician.lowAdherenceAlerts,
      value: stats?.lowAdherenceCount || 0,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      link: "/dashboard/adherence",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.clinician.dashboardTitle}</h1>
        <p className="text-muted-foreground">
          {t.clinician.dashboardSubtitle}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-col items-center justify-center pb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor} mb-1`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <CardTitle className="text-sm font-bold text-center">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              {isLoading ? (
                <Skeleton className="h-8 w-16 mx-auto" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
              <Link to={stat.link}>
                <Button variant="link" className="px-0 mt-1 h-auto text-xs">
                  {t.common.viewDetails} →
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Flags Card */}
      <PatientRiskFlagsCard />

      {/* Alert Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <RedFlagAlertsCard />
        <PolypharmacyWarningsCard />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/dashboard/patients">
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              {t.clinician.viewPatientRoster}
            </Button>
          </Link>
          <Link to="/dashboard/appointments">
            <Button variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              {t.clinician.manageAppointments}
            </Button>
          </Link>
          <Link to="/dashboard/adherence">
            <Button variant="outline" className="gap-2">
              <Activity className="h-4 w-4" />
              {t.clinician.checkAdherenceReports}
            </Button>
          </Link>
          <Link to="/dashboard/soap-notes">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              {t.clinician.writeSOAPNotes}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
