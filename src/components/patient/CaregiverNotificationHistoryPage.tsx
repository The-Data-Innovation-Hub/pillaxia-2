import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Pill,
  User,
  XCircle,
} from "lucide-react";
import { format, subDays } from "date-fns";

interface MissedDoseLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  status: string;
  user_id: string;
  medication_name: string;
  patient_name: string;
}

export function CaregiverNotificationHistoryPage() {
  const { user } = useAuth();

  const { data: missedDoses, isLoading } = useQuery({
    queryKey: ["caregiver-notification-history", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all accepted caregiver relationships
      const { data: invitations, error: invError } = await supabase
        .from("caregiver_invitations")
        .select("patient_user_id, permissions")
        .eq("caregiver_user_id", user.id)
        .eq("status", "accepted");

      if (invError) throw invError;
      if (!invitations || invitations.length === 0) return [];

      // Filter for patients where we have adherence permission
      const patientIds = invitations
        .filter((inv) => {
          const permissions = inv.permissions as Record<string, boolean> | null;
          return permissions?.view_adherence;
        })
        .map((inv) => inv.patient_user_id);

      if (patientIds.length === 0) return [];

      // Fetch patient profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [
          p.user_id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Patient",
        ])
      );

      // Fetch missed doses from last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30);
      const { data: logs, error: logsError } = await supabase
        .from("medication_logs")
        .select(`
          id,
          medication_id,
          scheduled_time,
          status,
          user_id,
          medications(name)
        `)
        .in("user_id", patientIds)
        .in("status", ["missed", "skipped"])
        .gte("scheduled_time", thirtyDaysAgo.toISOString())
        .order("scheduled_time", { ascending: false });

      if (logsError) throw logsError;

      return (logs || []).map((log) => ({
        id: log.id,
        medication_id: log.medication_id,
        scheduled_time: log.scheduled_time,
        status: log.status,
        user_id: log.user_id,
        medication_name: (log.medications as { name: string } | null)?.name || "Unknown Medication",
        patient_name: profileMap.get(log.user_id) || "Patient",
      })) as MissedDoseLog[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-muted-foreground">
            Past missed doses and alerts from your patients
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const groupedByDate = (missedDoses || []).reduce((acc, dose) => {
    const dateKey = format(new Date(dose.scheduled_time), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(dose);
    return acc;
  }, {} as Record<string, MissedDoseLog[]>);

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-muted-foreground">
            Past missed doses and alerts from the last 30 days
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          {missedDoses?.length || 0} alerts
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Missed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {missedDoses?.filter((d) => d.status === "missed").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Doses not taken</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Skipped</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {missedDoses?.filter((d) => d.status === "skipped").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Intentionally skipped</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Patients</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(missedDoses?.map((d) => d.user_id)).size || 0}
            </div>
            <p className="text-xs text-muted-foreground">With alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      {sortedDates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Missed Doses</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Great news! None of your patients have missed any doses in the last 30 days.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">
                  {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {groupedByDate[dateKey].length} alert{groupedByDate[dateKey].length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-2 ml-6">
                {groupedByDate[dateKey].map((dose) => (
                  <Card key={dose.id} className="overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          dose.status === "missed"
                            ? "bg-destructive/10"
                            : "bg-warning/10"
                        }`}
                      >
                        {dose.status === "missed" ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-warning" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{dose.patient_name}</p>
                          <Badge
                            variant={dose.status === "missed" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {dose.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Pill className="h-3.5 w-3.5" />
                            {dose.medication_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(dose.scheduled_time), "h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
