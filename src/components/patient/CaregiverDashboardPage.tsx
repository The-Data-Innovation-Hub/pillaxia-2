import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMissedDoseAlerts } from "@/hooks/useMissedDoseAlerts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  Loader2,
  Pill,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Bell,
  MessageCircleHeart,
  MessageCircle,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { SendEncouragementDialog } from "./SendEncouragementDialog";
import ChatDialog from "./ChatDialog";

interface CaregiverPermissions {
  view_medications?: boolean;
  view_adherence?: boolean;
  view_symptoms?: boolean;
}

interface PatientWithData {
  patient_user_id: string;
  permissions: CaregiverPermissions;
  patient_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  medications: Array<{
    id: string;
    name: string;
    dosage: string;
    dosage_unit: string;
    is_active: boolean;
  }>;
  adherenceStats: {
    total: number;
    taken: number;
    missed: number;
    pending: number;
    percentage: number;
  };
  recentSymptoms: Array<{
    id: string;
    symptom_type: string;
    severity: number;
    recorded_at: string;
    description: string | null;
  }>;
}

export function CaregiverDashboardPage() {
  const { user, profile } = useAuth();

  // Fetch all accepted caregiver relationships with patient data
  const { data: patients, isLoading } = useQuery({
    queryKey: ["caregiver-patients", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all accepted invitations for this caregiver
      const { data: invitations, error: invError } = await supabase
        .from("caregiver_invitations")
        .select("*")
        .eq("caregiver_user_id", user.id)
        .eq("status", "accepted");

      if (invError) throw invError;
      if (!invitations || invitations.length === 0) return [];

      // Fetch data for each patient
      const patientsWithData = await Promise.all(
        invitations.map(async (inv) => {
          const permissions = (inv.permissions as CaregiverPermissions) || {};

          // Fetch patient profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("user_id", inv.patient_user_id)
            .maybeSingle();

          // Fetch medications if permitted
          let medications: PatientWithData["medications"] = [];
          if (permissions.view_medications) {
            const { data: meds } = await supabase
              .from("medications")
              .select("id, name, dosage, dosage_unit, is_active")
              .eq("user_id", inv.patient_user_id)
              .eq("is_active", true);
            medications = meds || [];
          }

          // Fetch adherence stats (last 7 days) if permitted
          let adherenceStats = { total: 0, taken: 0, missed: 0, pending: 0, percentage: 0 };
          if (permissions.view_adherence) {
            const sevenDaysAgo = subDays(new Date(), 7);
            const { data: logs } = await supabase
              .from("medication_logs")
              .select("status")
              .eq("user_id", inv.patient_user_id)
              .gte("scheduled_time", sevenDaysAgo.toISOString());

            if (logs) {
              adherenceStats.total = logs.length;
              adherenceStats.taken = logs.filter((l) => l.status === "taken").length;
              adherenceStats.missed = logs.filter((l) => l.status === "missed").length;
              adherenceStats.pending = logs.filter((l) => l.status === "pending").length;
              adherenceStats.percentage =
                adherenceStats.total > 0
                  ? Math.round((adherenceStats.taken / (adherenceStats.taken + adherenceStats.missed)) * 100) || 0
                  : 0;
            }
          }

          // Fetch recent symptoms (last 7 days) if permitted
          let recentSymptoms: PatientWithData["recentSymptoms"] = [];
          if (permissions.view_symptoms) {
            const sevenDaysAgo = subDays(new Date(), 7);
            const { data: symptoms } = await supabase
              .from("symptom_entries")
              .select("id, symptom_type, severity, recorded_at, description")
              .eq("user_id", inv.patient_user_id)
              .gte("recorded_at", sevenDaysAgo.toISOString())
              .order("recorded_at", { ascending: false })
              .limit(10);
            recentSymptoms = symptoms || [];
          }

          return {
            patient_user_id: inv.patient_user_id,
            permissions,
            patient_profile: profile,
            medications,
            adherenceStats,
            recentSymptoms,
          } as PatientWithData;
        })
      );

      return patientsWithData;
    },
    enabled: !!user,
  });

  // Prepare patient info for missed dose alerts
  const patientInfoForAlerts = useMemo(() => {
    if (!patients) return [];
    return patients.map((p) => ({
      patient_user_id: p.patient_user_id,
      patient_name: p.patient_profile?.first_name
        ? `${p.patient_profile.first_name} ${p.patient_profile.last_name || ""}`
        : "Patient",
      medications: new Map(p.medications.map((m) => [m.id, m.name])),
    }));
  }, [patients]);

  // Enable real-time missed dose alerts
  useMissedDoseAlerts(patientInfoForAlerts, !!patients && patients.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patients || patients.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Caregiver Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor the patients you're caring for
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Patients Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You haven't accepted any caregiver invitations yet. When a patient
              invites you, you'll be able to monitor their health data here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caregiver Dashboard</h1>
          <p className="text-muted-foreground">
            Monitoring {patients.length} patient{patients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5">
          <Bell className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="text-xs">Real-time alerts active</span>
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients.length}</div>
            <p className="text-xs text-muted-foreground">
              Active care relationships
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Adherence</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(() => {
              const patientsWithAdherence = patients.filter(
                (p) => p.permissions.view_adherence && p.adherenceStats.total > 0
              );
              const avgAdherence =
                patientsWithAdherence.length > 0
                  ? Math.round(
                      patientsWithAdherence.reduce(
                        (acc, p) => acc + p.adherenceStats.percentage,
                        0
                      ) / patientsWithAdherence.length
                    )
                  : 0;
              return (
                <>
                  <div className="text-2xl font-bold">{avgAdherence}%</div>
                  <p className="text-xs text-muted-foreground">
                    Last 7 days average
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Symptoms</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patients.reduce((acc, p) => acc + p.recentSymptoms.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Reported in last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Cards */}
      <Tabs defaultValue={patients[0]?.patient_user_id} className="space-y-4">
        <TabsList className="w-full flex-wrap h-auto gap-2 bg-transparent p-0">
          {patients.map((patient) => (
            <TabsTrigger
              key={patient.patient_user_id}
              value={patient.patient_user_id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
            {patient.patient_profile?.first_name || "Patient"}{" "}
            {patient.patient_profile?.last_name || ""}
            </TabsTrigger>
          ))}
        </TabsList>

        {patients.map((patient) => {
          const caregiverName = profile?.first_name 
            ? `${profile.first_name} ${profile.last_name || ""}`.trim()
            : "Your Caregiver";
          return (
            <TabsContent
              key={patient.patient_user_id}
              value={patient.patient_user_id}
              className="space-y-6"
            >
              <PatientDetailView 
                patient={patient} 
                caregiverName={caregiverName} 
                caregiverId={user?.id || ""} 
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function PatientDetailView({ patient, caregiverName, caregiverId }: { patient: PatientWithData; caregiverName: string; caregiverId: string }) {
  const [showEncouragementDialog, setShowEncouragementDialog] = useState(false);
  const [showChatDialog, setShowChatDialog] = useState(false);
  
  const patientName = patient.patient_profile?.first_name
    ? `${patient.patient_profile.first_name} ${patient.patient_profile.last_name || ""}`
    : "Patient";
  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {patientName}
              </CardTitle>
              <CardDescription>
                {patient.patient_profile?.email || "Email not available"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowChatDialog(true)}
                className="gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                Chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEncouragementDialog(true)}
                className="gap-1.5"
              >
                <MessageCircleHeart className="h-4 w-4" />
                Quick Message
              </Button>
              {patient.permissions.view_medications && (
                <Badge variant="outline" className="text-xs">
                  <Pill className="h-3 w-3 mr-1" />
                  Medications
                </Badge>
              )}
              {patient.permissions.view_adherence && (
                <Badge variant="outline" className="text-xs">
                  <Activity className="h-3 w-3 mr-1" />
                  Adherence
                </Badge>
              )}
              {patient.permissions.view_symptoms && (
                <Badge variant="outline" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Symptoms
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <SendEncouragementDialog
          open={showEncouragementDialog}
          onOpenChange={setShowEncouragementDialog}
          patientUserId={patient.patient_user_id}
          patientName={patientName}
          caregiverName={caregiverName}
        />
        
        <ChatDialog
          open={showChatDialog}
          onOpenChange={setShowChatDialog}
          caregiverId={caregiverId}
          caregiverName={caregiverName}
          patientId={patient.patient_user_id}
          viewerRole="caregiver"
        />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Medications */}
        {patient.permissions.view_medications && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Pill className="h-5 w-5 text-primary" />
                Active Medications
              </CardTitle>
              <CardDescription>
                Current prescriptions for {patientName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patient.medications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active medications
                </p>
              ) : (
                <div className="space-y-3">
                  {patient.medications.map((med) => (
                    <div
                      key={med.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {med.dosage} {med.dosage_unit}
                        </p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Adherence */}
        {patient.permissions.view_adherence && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                7-Day Adherence
              </CardTitle>
              <CardDescription>
                Medication compliance over the last week
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {patient.adherenceStats.total === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No doses scheduled in the last 7 days
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall</span>
                      <span
                        className={`text-2xl font-bold ${
                          patient.adherenceStats.percentage >= 80
                            ? "text-primary"
                            : patient.adherenceStats.percentage >= 50
                            ? "text-accent-foreground"
                            : "text-destructive"
                        }`}
                      >
                        {patient.adherenceStats.percentage}%
                      </span>
                    </div>
                    <Progress
                      value={patient.adherenceStats.percentage}
                      className="h-3"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xl font-bold">
                          {patient.adherenceStats.taken}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Taken</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xl font-bold">
                          {patient.adherenceStats.missed}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Missed</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-xl font-bold">
                          {patient.adherenceStats.pending}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Symptoms */}
      {patient.permissions.view_symptoms && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Recent Symptoms
            </CardTitle>
            <CardDescription>
              Symptoms reported in the last 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {patient.recentSymptoms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No symptoms reported recently
              </p>
            ) : (
              <div className="space-y-3">
                {patient.recentSymptoms.map((symptom) => (
                  <div
                    key={symptom.id}
                    className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="space-y-1">
                      <p className="font-medium capitalize">{symptom.symptom_type}</p>
                      {symptom.description && (
                        <p className="text-sm text-muted-foreground">
                          {symptom.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(symptom.recorded_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Badge
                      variant={
                        symptom.severity >= 7
                          ? "destructive"
                          : symptom.severity >= 4
                          ? "secondary"
                          : "outline"
                      }
                    >
                      Severity: {symptom.severity}/10
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No permissions message */}
      {!patient.permissions.view_medications &&
        !patient.permissions.view_adherence &&
        !patient.permissions.view_symptoms && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                You don't have permission to view any data for this patient.
                Ask them to update your permissions.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
