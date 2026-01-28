import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Pill, Activity, Shield, FileText, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AdminDashboardHome() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Get total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get user role counts
      const { data: roles } = await supabase
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

      // Get total medications
      const { count: totalMedications } = await supabase
        .from("medications")
        .select("*", { count: "exact", head: true });

      // Get total organizations
      const { count: totalOrganizations } = await supabase
        .from("organizations")
        .select("*", { count: "exact", head: true });

      // Get recent audit logs count (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentAuditLogs } = await supabase
        .from("audit_log")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneDayAgo);

      return {
        totalUsers: totalUsers || 0,
        roleCounts,
        totalMedications: totalMedications || 0,
        totalOrganizations: totalOrganizations || 0,
        recentAuditLogs: recentAuditLogs || 0,
      };
    },
  });

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/dashboard/users",
    },
    {
      title: "Organizations",
      value: stats?.totalOrganizations || 0,
      icon: Building2,
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      link: "/dashboard/organization",
    },
    {
      title: "Total Medications",
      value: stats?.totalMedications || 0,
      icon: Pill,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Recent Activity (24h)",
      value: stats?.recentAuditLogs || 0,
      icon: Activity,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      link: "/dashboard/audit-logs",
    },
  ];

  const roleCards = [
    { role: "Patients", count: stats?.roleCounts?.patient || 0, icon: Users },
    { role: "Clinicians", count: stats?.roleCounts?.clinician || 0, icon: Activity },
    { role: "Pharmacists", count: stats?.roleCounts?.pharmacist || 0, icon: Pill },
    { role: "Admins", count: stats?.roleCounts?.admin || 0, icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System overview and management
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor} mb-1`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <CardTitle className="text-sm">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mx-auto" />
              ) : (
                <div className="text-3xl font-bold">{stat.value}</div>
              )}
              {stat.link && (
                <Link to={stat.link}>
                  <Button variant="link" className="px-0 mt-1 h-auto text-xs">
                    View details →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>User Distribution by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            {roleCards.map((role) => (
              <div
                key={role.role}
                className="flex items-center gap-3 p-4 rounded-lg border"
              >
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <role.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? <Skeleton className="h-7 w-8" /> : role.count}
                  </p>
                  <p className="text-sm text-muted-foreground">{role.role}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/dashboard/users">
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              Manage Users
            </Button>
          </Link>
          <Link to="/dashboard/analytics">
            <Button variant="outline" className="gap-2">
              <Activity className="h-4 w-4" />
              View Analytics
            </Button>
          </Link>
          <Link to="/dashboard/audit-logs">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Audit Logs
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
