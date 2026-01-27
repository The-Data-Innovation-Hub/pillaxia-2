import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pill, Check, AlertCircle, User } from "lucide-react";

interface PolypharmacyWarning {
  id: string;
  patient_user_id: string;
  medication_count: number;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

interface PatientProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
}

export function PolypharmacyWarningsCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [patients, setPatients] = useState<Map<string, PatientProfile>>(new Map());

  // Fetch polypharmacy warnings for assigned patients
  const { data: warnings, isLoading } = useQuery({
    queryKey: ["polypharmacy-warnings", user?.id],
    queryFn: async () => {
      // First get assigned patient IDs
      const { data: assignments } = await supabase
        .from("clinician_patient_assignments")
        .select("patient_user_id")
        .eq("clinician_user_id", user!.id);

      if (!assignments?.length) return [];

      const patientIds = assignments.map((a) => a.patient_user_id);

      // Then get warnings for those patients
      const { data, error } = await supabase
        .from("polypharmacy_warnings")
        .select("*")
        .in("patient_user_id", patientIds)
        .order("medication_count", { ascending: false });

      if (error) throw error;
      return data as PolypharmacyWarning[];
    },
    enabled: !!user,
  });

  // Fetch patient profiles
  useEffect(() => {
    if (warnings?.length) {
      const patientIds = [...new Set(warnings.map((w) => w.patient_user_id))];

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
  }, [warnings]);

  // Acknowledge mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (warningId: string) => {
      const { error } = await supabase
        .from("polypharmacy_warnings")
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user!.id,
        })
        .eq("id", warningId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polypharmacy-warnings"] });
      toast.success("Warning acknowledged");
    },
    onError: () => {
      toast.error("Failed to acknowledge warning");
    },
  });

  const getPatientName = (patientId: string) => {
    const patient = patients.get(patientId);
    return patient
      ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || "Unknown"
      : "Loading...";
  };

  const unacknowledgedCount = warnings?.filter((w) => !w.is_acknowledged).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-amber-500" />
            Polypharmacy Alerts
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
    <Card className={unacknowledgedCount > 0 ? "border-amber-500" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pill className={`h-5 w-5 ${unacknowledgedCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            Polypharmacy Alerts
          </div>
          {unacknowledgedCount > 0 && (
            <Badge className="bg-amber-500 hover:bg-amber-600">
              {unacknowledgedCount} to review
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!warnings?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No polypharmacy alerts</p>
            <p className="text-sm">Patients on 5+ medications will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {warnings.map((warning) => (
              <div
                key={warning.id}
                className={`p-4 rounded-lg border ${
                  warning.is_acknowledged
                    ? "bg-muted/30 border-muted"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      warning.is_acknowledged ? "bg-muted" : "bg-amber-100 dark:bg-amber-900/50"
                    }`}>
                      <User className={`h-4 w-4 ${
                        warning.is_acknowledged ? "text-muted-foreground" : "text-amber-600"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{getPatientName(warning.patient_user_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className={`font-bold ${
                          warning.medication_count >= 7 
                            ? "text-destructive" 
                            : "text-amber-600"
                        }`}>
                          {warning.medication_count}
                        </span>
                        {" "}active medications
                        {warning.medication_count >= 7 && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            High Risk
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>

                  {!warning.is_acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeMutation.mutate(warning.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Review
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
