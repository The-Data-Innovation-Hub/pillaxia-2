import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from "lucide-react";
import { format, subDays } from "date-fns";

interface PatientAdherence {
  patientId: string;
  patientName: string;
  current7Day: number;
  previous7Day: number;
  trend: "up" | "down" | "stable";
  totalDoses: number;
  takenDoses: number;
  skippedDoses: number;
  missedDoses: number;
}

export function AdherenceMonitorPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<"7" | "14" | "30">("7");

  const { data, isLoading } = useQuery({
    queryKey: ["clinician-adherence", user?.id, timeRange],
    queryFn: async () => {
      // Get assignments
      const { data: assignments } = await supabase
        .from("clinician_patient_assignments")
        .select("patient_user_id")
        .eq("clinician_user_id", user!.id);

      if (!assignments?.length) return [];

      const patientIds = assignments.map((a) => a.patient_user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds);

      const days = parseInt(timeRange);
      const currentStart = subDays(new Date(), days);
      const previousStart = subDays(currentStart, days);

      // Get current period logs
      const { data: currentLogs } = await supabase
        .from("medication_logs")
        .select("user_id, status")
        .in("user_id", patientIds)
        .gte("scheduled_time", currentStart.toISOString());

      // Get previous period logs
      const { data: previousLogs } = await supabase
        .from("medication_logs")
        .select("user_id, status")
        .in("user_id", patientIds)
        .gte("scheduled_time", previousStart.toISOString())
        .lt("scheduled_time", currentStart.toISOString());

      // Calculate adherence per patient
      const patientAdherence: PatientAdherence[] = patientIds.map((patientId) => {
        const profile = profiles?.find((p) => p.user_id === patientId);
        const currentPatientLogs = currentLogs?.filter((l) => l.user_id === patientId) || [];
        const previousPatientLogs = previousLogs?.filter((l) => l.user_id === patientId) || [];

        const currentTaken = currentPatientLogs.filter((l) => l.status === "taken").length;
        const currentTotal = currentPatientLogs.length;
        const current7Day = currentTotal > 0 ? Math.round((currentTaken / currentTotal) * 100) : 100;

        const previousTaken = previousPatientLogs.filter((l) => l.status === "taken").length;
        const previousTotal = previousPatientLogs.length;
        const previous7Day = previousTotal > 0 ? Math.round((previousTaken / previousTotal) * 100) : 100;

        let trend: "up" | "down" | "stable" = "stable";
        if (current7Day > previous7Day + 5) trend = "up";
        else if (current7Day < previous7Day - 5) trend = "down";

        return {
          patientId,
          patientName: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
          current7Day,
          previous7Day,
          trend,
          totalDoses: currentTotal,
          takenDoses: currentTaken,
          skippedDoses: currentPatientLogs.filter((l) => l.status === "skipped").length,
          missedDoses: currentPatientLogs.filter((l) => l.status === "missed").length,
        };
      });

      // Sort by adherence (lowest first for alerts)
      return patientAdherence.sort((a, b) => a.current7Day - b.current7Day);
    },
    enabled: !!user,
  });

  const lowAdherencePatients = data?.filter((p) => p.current7Day < 80) || [];
  const goodAdherencePatients = data?.filter((p) => p.current7Day >= 80) || [];
  const avgAdherence = data?.length
    ? Math.round(data.reduce((acc, p) => acc + p.current7Day, 0) / data.length)
    : 0;

  const TrendIcon = ({ trend }: { trend: "up" | "down" | "stable" }) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 80) return "bg-green-500";
    if (adherence >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Adherence Monitor</h1>
          <p className="text-muted-foreground">Track medication adherence across your patients</p>
        </div>
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as "7" | "14" | "30")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Adherence</p>
                <p className="text-3xl font-bold">{avgAdherence}%</p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                avgAdherence >= 80 ? "bg-green-100" : avgAdherence >= 60 ? "bg-amber-100" : "bg-red-100"
              }`}>
                {avgAdherence >= 80 ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Patients &lt;80% Adherence</p>
              <p className="text-3xl font-bold text-red-600">{lowAdherencePatients.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Patients ≥80% Adherence</p>
              <p className="text-3xl font-bold text-green-600">{goodAdherencePatients.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {lowAdherencePatients.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Patients Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowAdherencePatients.map((patient) => (
                <div
                  key={patient.patientId}
                  className="p-4 rounded-lg bg-background border flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">{patient.patientName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{patient.takenDoses}/{patient.totalDoses} doses taken</span>
                        <span>•</span>
                        <span>{patient.missedDoses} missed</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>{patient.current7Day}%</span>
                        <TrendIcon trend={patient.trend} />
                      </div>
                      <Progress value={patient.current7Day} className={getAdherenceColor(patient.current7Day)} />
                    </div>
                    <Badge variant="destructive">{patient.current7Day}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Patients */}
      <Card>
        <CardHeader>
          <CardTitle>All Patients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No patients assigned yet
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((patient) => (
                <div
                  key={patient.patientId}
                  className="p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      patient.current7Day >= 80 ? "bg-green-100" : patient.current7Day >= 60 ? "bg-amber-100" : "bg-red-100"
                    }`}>
                      <User className={`h-5 w-5 ${
                        patient.current7Day >= 80 ? "text-green-600" : patient.current7Day >= 60 ? "text-amber-600" : "text-red-600"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{patient.patientName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{patient.takenDoses} taken</span>
                        <span>•</span>
                        <span>{patient.skippedDoses} skipped</span>
                        <span>•</span>
                        <span>{patient.missedDoses} missed</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-40">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">vs prev: {patient.previous7Day}%</span>
                        <TrendIcon trend={patient.trend} />
                      </div>
                      <Progress 
                        value={patient.current7Day} 
                        className={`h-2 ${getAdherenceColor(patient.current7Day)}`}
                      />
                    </div>
                    <Badge className={
                      patient.current7Day >= 80
                        ? "bg-green-100 text-green-700"
                        : patient.current7Day >= 60
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }>
                      {patient.current7Day}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
