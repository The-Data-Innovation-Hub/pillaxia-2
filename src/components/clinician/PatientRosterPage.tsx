import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, User, Pill, Activity, Calendar, UserPlus, UserMinus, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PatientDetails {
  userId: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  assignedAt?: string;
  medicationCount: number;
  recentAdherence: number;
  isAssigned: boolean;
}

export function PatientRosterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null);
  const [unassignPatient, setUnassignPatient] = useState<PatientDetails | null>(null);
  const [activeTab, setActiveTab] = useState("assigned");

  // Get clinician's assigned patients and all patients in a single query
  const { data: patientsData, isLoading } = useQuery({
    queryKey: ["clinician-patients-roster", user?.id],
    queryFn: async () => {
      // Get assignments first
      const { data: assignments, error: assignError } = await supabase
        .from("clinician_patient_assignments")
        .select("patient_user_id, assigned_at, notes")
        .eq("clinician_user_id", user!.id);

      if (assignError) throw assignError;
      
      const assignmentMap = new Map(
        (assignments || []).map(a => [a.patient_user_id, a])
      );

      // Get all users with patient role
      const { data: patientRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "patient");

      if (rolesError) throw rolesError;
      if (!patientRoles?.length) return { assigned: [], unassigned: [] };

      const patientIds = patientRoles.map((r) => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, phone")
        .in("user_id", patientIds);

      // Get medication counts
      const { data: medications } = await supabase
        .from("medications")
        .select("user_id, id")
        .in("user_id", patientIds)
        .eq("is_active", true);

      // Get adherence data (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logs } = await supabase
        .from("medication_logs")
        .select("user_id, status")
        .in("user_id", patientIds)
        .gte("scheduled_time", sevenDaysAgo.toISOString());

      // Build patient details
      const allPatients: PatientDetails[] = patientIds.map((patientId) => {
        const profile = profiles?.find((p) => p.user_id === patientId);
        const patientMeds = medications?.filter((m) => m.user_id === patientId) || [];
        const patientLogs = logs?.filter((l) => l.user_id === patientId) || [];
        const assignment = assignmentMap.get(patientId);

        const adherence =
          patientLogs.length > 0
            ? Math.round(
                (patientLogs.filter((l) => l.status === "taken").length / patientLogs.length) * 100
              )
            : 100;

        return {
          userId: patientId,
          profile: {
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            email: profile?.email || null,
            phone: profile?.phone || null,
          },
          assignedAt: assignment?.assigned_at,
          medicationCount: patientMeds.length,
          recentAdherence: adherence,
          isAssigned: !!assignment,
        };
      });

      return {
        assigned: allPatients.filter(p => p.isAssigned),
        unassigned: allPatients.filter(p => !p.isAssigned),
      };
    },
    enabled: !!user,
  });

  const assignMutation = useMutation({
    mutationFn: async (patientUserId: string) => {
      const { error } = await supabase
        .from("clinician_patient_assignments")
        .insert({
          clinician_user_id: user!.id,
          patient_user_id: patientUserId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient assigned successfully");
      queryClient.invalidateQueries({ queryKey: ["clinician-patients-roster"] });
    },
    onError: (error) => {
      console.error("Assignment error:", error);
      toast.error("Failed to assign patient");
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (patientUserId: string) => {
      const { error } = await supabase
        .from("clinician_patient_assignments")
        .delete()
        .eq("clinician_user_id", user!.id)
        .eq("patient_user_id", patientUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient unassigned successfully");
      setUnassignPatient(null);
      queryClient.invalidateQueries({ queryKey: ["clinician-patients-roster"] });
    },
    onError: (error) => {
      console.error("Unassign error:", error);
      toast.error("Failed to unassign patient");
    },
  });

  const assignedPatients = patientsData?.assigned || [];
  const unassignedPatients = patientsData?.unassigned || [];

  const filterPatients = (patients: PatientDetails[]) => {
    if (!searchQuery) return patients;
    const query = searchQuery.toLowerCase();
    return patients.filter((patient) => {
      const name = `${patient.profile.first_name || ""} ${patient.profile.last_name || ""}`.toLowerCase();
      const email = (patient.profile.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  };

  const getAdherenceBadge = (adherence: number) => {
    if (adherence >= 80) return <Badge className="bg-green-100 text-green-700">Good ({adherence}%)</Badge>;
    if (adherence >= 60) return <Badge className="bg-amber-100 text-amber-700">Fair ({adherence}%)</Badge>;
    return <Badge className="bg-red-100 text-red-700">Low ({adherence}%)</Badge>;
  };

  const PatientTable = ({ patients, showAssignButton }: { patients: PatientDetails[]; showAssignButton: boolean }) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Active Meds</TableHead>
            <TableHead>7-Day Adherence</TableHead>
            {!showAssignButton && <TableHead>Assigned</TableHead>}
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.userId}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {patient.profile.first_name} {patient.profile.last_name}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-sm">{patient.profile.email || "—"}</p>
                <p className="text-xs text-muted-foreground">{patient.profile.phone || "—"}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <span>{patient.medicationCount}</span>
                </div>
              </TableCell>
              <TableCell>{getAdherenceBadge(patient.recentAdherence)}</TableCell>
              {!showAssignButton && patient.assignedAt && (
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(patient.assignedAt), "MMM d, yyyy")}
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2">
                  {showAssignButton ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => assignMutation.mutate(patient.userId)}
                      disabled={assignMutation.isPending}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Assign
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPatient(patient)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setUnassignPatient(patient)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Roster</h1>
        <p className="text-muted-foreground">View and manage your assigned patients</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patient Management
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="assigned" className="gap-2">
                My Patients
                {assignedPatients.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{assignedPatients.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="available" className="gap-2">
                Available Patients
                {unassignedPatients.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{unassignedPatients.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assigned">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filterPatients(assignedPatients).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "No assigned patients match your search"
                    : "No patients assigned yet. Browse the 'Available Patients' tab to assign patients."}
                </div>
              ) : (
                <PatientTable patients={filterPatients(assignedPatients)} showAssignButton={false} />
              )}
            </TabsContent>

            <TabsContent value="available">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filterPatients(unassignedPatients).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "No available patients match your search"
                    : "All patients are already assigned to you."}
                </div>
              ) : (
                <PatientTable patients={filterPatients(unassignedPatients)} showAssignButton={true} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Patient Details Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedPatient.profile.first_name} {selectedPatient.profile.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedPatient.profile.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Pill className="h-4 w-4" />
                    <span className="text-xs">Active Medications</span>
                  </div>
                  <p className="text-2xl font-bold">{selectedPatient.medicationCount}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs">7-Day Adherence</span>
                  </div>
                  <p className="text-2xl font-bold">{selectedPatient.recentAdherence}%</p>
                </div>
              </div>

              {selectedPatient.assignedAt && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">Assigned Since</span>
                  </div>
                  <p className="font-medium">
                    {format(new Date(selectedPatient.assignedAt), "MMMM d, yyyy")}
                  </p>
                </div>
              )}

              {selectedPatient.profile.phone && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Phone: </span>
                  {selectedPatient.profile.phone}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={!!unassignPatient} onOpenChange={() => setUnassignPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Patient?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign{" "}
              <strong>
                {unassignPatient?.profile.first_name} {unassignPatient?.profile.last_name}
              </strong>
              ? You will no longer have access to their medication and adherence data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unassignPatient && unassignMutation.mutate(unassignPatient.userId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
