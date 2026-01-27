import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, Check, Bell, User } from "lucide-react";

interface RedFlagAlert {
  id: string;
  patient_user_id: string;
  clinician_user_id: string;
  symptom_entry_id: string | null;
  alert_type: string;
  severity: number;
  symptom_type: string;
  description: string | null;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

interface PatientProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

export function RedFlagAlertsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [patients, setPatients] = useState<Map<string, PatientProfile>>(new Map());

  // Fetch red flag alerts
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["red-flag-alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("red_flag_alerts")
        .select("*")
        .eq("clinician_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as RedFlagAlert[];
    },
    enabled: !!user,
  });

  // Fetch patient profiles
  useEffect(() => {
    if (alerts?.length) {
      const patientIds = [...new Set(alerts.map((a) => a.patient_user_id))];
      
      supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds)
        .then(({ data }) => {
          const map = new Map<string, PatientProfile>();
          data?.forEach((p) => map.set(p.user_id, p));
          setPatients(map);
        });
    }
  }, [alerts]);

  // Subscribe to realtime alerts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("red-flag-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "red_flag_alerts",
          filter: `clinician_user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["red-flag-alerts"] });
          toast.error("🚨 New red flag alert!", {
            description: `Severe ${payload.new.symptom_type} reported`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("red_flag_alerts")
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user!.id,
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["red-flag-alerts"] });
      toast.success("Alert acknowledged");
    },
    onError: () => {
      toast.error("Failed to acknowledge alert");
    },
  });

  const getPatientName = (patientId: string) => {
    const patient = patients.get(patientId);
    return patient
      ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown"
      : "Loading...";
  };

  const unacknowledgedCount = alerts?.filter((a) => !a.is_acknowledged).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Red Flag Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={unacknowledgedCount > 0 ? "border-destructive" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${unacknowledgedCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            Red Flag Alerts
          </div>
          {unacknowledgedCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {unacknowledgedCount} unread
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!alerts?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No red flag alerts</p>
            <p className="text-sm">Severe symptoms will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.is_acknowledged
                    ? "bg-muted/30 border-muted"
                    : "bg-destructive/5 border-destructive/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      alert.is_acknowledged ? "bg-muted" : "bg-destructive/10"
                    }`}>
                      <User className={`h-4 w-4 ${
                        alert.is_acknowledged ? "text-muted-foreground" : "text-destructive"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{getPatientName(alert.patient_user_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-destructive">
                          {alert.symptom_type}
                        </span>
                        {" • "}
                        Severity {alert.severity}/10
                      </p>
                      {alert.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          "{alert.description}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(alert.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>

                  {!alert.is_acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Ack
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
