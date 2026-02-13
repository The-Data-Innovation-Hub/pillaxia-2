import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  listClinicianPatientAssignments,
  listMedications,
  listMedicationLogs,
} from "@/integrations/azure/data";
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
      const assignments = await listClinicianPatientAssignments(user!.id);
      const patientIds = (assignments || []).map((a) => a.patient_user_id as string);
      const patientCount = patientIds.length;

      let activeMedications = 0;
      let lowAdherenceCount = 0;

      if (patientIds.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fromStr = sevenDaysAgo.toISOString();

        let totalMeds = 0;
        const patientAdherence: Record<string, { taken: number; total: number }> = {};

        for (const pid of patientIds) {
          const [meds, logs] = await Promise.all([
            listMedications(pid),
            listMedicationLogs(pid, { from: fromStr }),
          ]);
          totalMeds += (meds || []).filter((m) => m.is_active !== false).length;
          (logs || []).forEach((log) => {
            const uid = log.user_id as string;
            if (!patientAdherence[uid]) patientAdherence[uid] = { taken: 0, total: 0 };
            patientAdherence[uid].total++;
            if (log.status === "taken") patientAdherence[uid].taken++;
          });
        }
        activeMedications = totalMeds;
        lowAdherenceCount = Object.values(patientAdherence).filter(
          (p) => p.total > 0 && p.taken / p.total < 0.8
        ).length;
      }

      return {
        patientCount,
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
