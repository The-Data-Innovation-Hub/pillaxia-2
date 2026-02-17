import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Pill, Activity, Shield, FileText, CheckCircle2, ClockAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

export function AdminDashboardHome() {
  const { t } = useLanguage();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Get user role counts
      const { data: roles } = await db
        .from("user_roles")
        .select("role");

      const roleCounts = {
        patient: 0,
        clinician: 0,
        pharmacist: 0,
        admin: 0,
      };

      roles?.forEach((r) => {
        if (r.role in roleCounts) {
          roleCounts[r.role as keyof typeof roleCounts]++;
        }
      });

      // Get active patients today (patients with medication logs today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: activePatientsData } = await db
        .from("medication_logs")
        .select("user_id")
        .gte("logged_at", today.toISOString());

      const uniquePatients = new Set(activePatientsData?.map(log => log.user_id) || []);
      const activePatientsToday = uniquePatients.size;

      // Get prescriptions filled this week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: prescriptionsFilledWeek } = await db
        .from("medications")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneWeekAgo);

      // Calculate adherence rate (medication logs taken vs scheduled)
      const { data: scheduledMeds } = await db
        .from("medication_schedules")
        .select("id")
        .gte("scheduled_time", oneWeekAgo);

      const { data: takenLogs } = await db
        .from("medication_logs")
        .select("id")
        .gte("logged_at", oneWeekAgo)
        .eq("status", "taken");

      const adherenceRate = scheduledMeds && scheduledMeds.length > 0
        ? Math.round((takenLogs?.length || 0) / scheduledMeds.length * 100)
        : 0;

      // Get pending approvals (medications awaiting approval)
      const { count: pendingApprovals } = await db
        .from("medications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      return {
        roleCounts,
        activePatientsToday,
        prescriptionsFilledWeek: prescriptionsFilledWeek || 0,
        adherenceRate,
        pendingApprovals: pendingApprovals || 0,
      };
    },
  });

  const statCards = [
    {
      title: "Active Patients Today",
      value: stats?.activePatientsToday || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Prescriptions This Week",
      value: stats?.prescriptionsFilledWeek || 0,
      icon: Pill,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Adherence Rate",
      value: `${stats?.adherenceRate || 0}%`,
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Approvals",
      value: stats?.pendingApprovals || 0,
      icon: ClockAlert,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  const roleCards = [
    { role: t.admin.patients, count: stats?.roleCounts?.patient || 0, icon: Users },
    { role: t.admin.clinicians, count: stats?.roleCounts?.clinician || 0, icon: Activity },
    { role: t.admin.pharmacists, count: stats?.roleCounts?.pharmacist || 0, icon: Pill },
    { role: t.admin.admins, count: stats?.roleCounts?.admin || 0, icon: Shield },
  ];

  const { isAdmin, isManager } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isManager && !isAdmin ? t.admin.managerDashboard : t.admin.dashboardTitle}
        </h1>
        <p className="text-muted-foreground">
          {isManager && !isAdmin ? t.admin.managerSubtitle : t.admin.dashboardSubtitle}
        </p>
      </div>

      {/* Role Distribution - Moved to top without heading */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roleCards.map((role) => (
          <Card key={role.role} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                  <role.icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : role.count}
                  </p>
                  <p className="text-sm text-muted-foreground">{role.role}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor} mb-1 w-fit`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <CardTitle className="text-sm">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.quickActions}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/dashboard/users">
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              {t.admin.manageUsers}
            </Button>
          </Link>
          <Link to="/dashboard/analytics">
            <Button variant="outline" className="gap-2">
              <Activity className="h-4 w-4" />
              {t.admin.viewAnalytics}
            </Button>
          </Link>
          <Link to="/dashboard/audit-logs">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              {t.admin.auditLogs}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
