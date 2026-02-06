import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, TrendingDown, CheckCircle, User } from "lucide-react";
import { toast } from "sonner";

interface RiskFlag {
  id: string;
  patient_user_id: string;
  flag_type: string;
  severity: string;
  description: string;
  metric_value: number | null;
  days_since_last_log: number | null;
  created_at: string;
  patient: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function PatientRiskFlagsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: riskFlags, isLoading } = useQuery({
    queryKey: ["patient-risk-flags", user?.id],
    queryFn: async () => {
      const { data: flags, error } = await db
        .from("patient_risk_flags")
        .select("*")
        .eq("is_resolved", false)
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get patient profiles
      const patientIds = [...new Set(flags?.map(f => f.patient_user_id) || [])];
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds);

      return (flags || []).map(flag => ({
        ...flag,
        patient: profiles?.find(p => p.user_id === flag.patient_user_id) || null,
      })) as RiskFlag[];
    },
    enabled: !!user,
  });

  const resolveMutation = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await db
        .from("patient_risk_flags")
        .update({ 
          is_resolved: true, 
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id 
        })
        .eq("id", flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-risk-flags"] });
      toast.success("Risk flag resolved");
    },
    onError: () => {
      toast.error("Failed to resolve flag");
    },
  });

  const criticalCount = riskFlags?.filter(f => f.severity === "critical").length || 0;
  const warningCount = riskFlags?.filter(f => f.severity === "warning").length || 0;

  const getFlagIcon = (flagType: string) => {
    switch (flagType) {
      case "no_logging":
        return Clock;
      case "low_adherence":
        return TrendingDown;
      default:
        return AlertTriangle;
    }
  };

  const getFlagLabel = (flagType: string) => {
    switch (flagType) {
      case "no_logging":
        return "No Activity";
      case "low_adherence":
        return "Low Adherence";
      default:
        return "Risk";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Patient Risk Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Patient Risk Flags
          </CardTitle>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} Critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary">{warningCount} Warning</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!riskFlags || riskFlags.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            No active risk flags
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {riskFlags.map((flag) => {
              const Icon = getFlagIcon(flag.flag_type);
              return (
                <div
                  key={flag.id}
                  className={`p-4 rounded-lg border ${
                    flag.severity === "critical"
                      ? "border-destructive/50 bg-destructive/5"
                      : "border-yellow-500/50 bg-yellow-500/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          flag.severity === "critical"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-yellow-500/10 text-yellow-600"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={flag.severity === "critical" ? "destructive" : "secondary"}
                          >
                            {getFlagLabel(flag.flag_type)}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <User className="h-3 w-3" />
                            {flag.patient?.first_name} {flag.patient?.last_name}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {flag.description}
                        </p>
                        {flag.flag_type === "low_adherence" && flag.metric_value !== null && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  flag.metric_value < 50
                                    ? "bg-destructive"
                                    : "bg-yellow-500"
                                }`}
                                style={{ width: `${flag.metric_value}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {flag.metric_value.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate(flag.id)}
                      disabled={resolveMutation.isPending}
                    >
                      Resolve
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
