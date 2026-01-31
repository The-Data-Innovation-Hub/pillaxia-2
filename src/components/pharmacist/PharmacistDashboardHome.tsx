import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Package, RefreshCw, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExpiryTrackingCard } from "./ExpiryTrackingCard";
import { useLanguage } from "@/i18n/LanguageContext";

export function PharmacistDashboardHome() {
  const { t } = useLanguage();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["pharmacist-stats"],
    queryFn: async () => {
      // Get total active medications (prescriptions) in the system
      const { count: totalPrescriptions } = await supabase
        .from("medications")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Get medications with low refills (simulating inventory alerts)
      const { data: lowRefillMeds } = await supabase
        .from("medications")
        .select("id, refills_remaining")
        .eq("is_active", true)
        .lte("refills_remaining", 2);

      // Get pending refill requests (medications where refills are 0)
      const { count: pendingRefills } = await supabase
        .from("medications")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("refills_remaining", 0);

      return {
        totalPrescriptions: totalPrescriptions || 0,
        lowStockAlerts: lowRefillMeds?.length || 0,
        pendingRefills: pendingRefills || 0,
      };
    },
  });

  const statCards = [
    {
      title: t.pharmacist.activePrescriptions,
      value: stats?.totalPrescriptions || 0,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/dashboard/prescriptions",
    },
    {
      title: t.pharmacist.lowRefillAlerts,
      value: stats?.lowStockAlerts || 0,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      link: "/dashboard/inventory",
    },
    {
      title: t.pharmacist.pendingRefills,
      value: stats?.pendingRefills || 0,
      icon: RefreshCw,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      link: "/dashboard/refills",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.pharmacist.dashboardTitle}</h1>
        <p className="text-muted-foreground">
          {t.pharmacist.dashboardSubtitle}
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

      {/* Expiry Tracking & Quick Actions Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpiryTrackingCard />
        
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.quickActions}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link to="/dashboard/prescriptions">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                {t.pharmacist.viewAllPrescriptions}
              </Button>
            </Link>
            <Link to="/dashboard/refills">
              <Button variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {t.pharmacist.processRefillRequests}
              </Button>
            </Link>
            <Link to="/dashboard/inventory">
              <Button variant="outline" className="gap-2">
                <Package className="h-4 w-4" />
                {t.pharmacist.checkInventory}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
