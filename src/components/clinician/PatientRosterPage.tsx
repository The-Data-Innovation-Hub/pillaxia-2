import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Search, User, Pill, Activity, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PatientDetails {
  userId: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  assignedAt: string;
  medicationCount: number;
  recentAdherence: number;
}

export function PatientRosterPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ["clinician-patients", user?.id],
    queryFn: async () => {
      // Get assignments
      const { data: assignments, error: assignError } = await supabase
        .from("clinician_patient_assignments")
        .select("patient_user_id, assigned_at, notes")
        .eq("clinician_user_id", user!.id);

      if (assignError) throw assignError;
      if (!assignments?.length) return [];

      const patientIds = assignments.map((a) => a.patient_user_id);

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
      const patientDetails: PatientDetails[] = assignments.map((assignment) => {
        const profile = profiles?.find((p) => p.user_id === assignment.patient_user_id);
        const patientMeds = medications?.filter((m) => m.user_id === assignment.patient_user_id) || [];
        const patientLogs = logs?.filter((l) => l.user_id === assignment.patient_user_id) || [];

        const adherence =
          patientLogs.length > 0
            ? Math.round(
                (patientLogs.filter((l) => l.status === "taken").length / patientLogs.length) * 100
              )
            : 100;

        return {
          userId: assignment.patient_user_id,
          profile: {
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            email: profile?.email || null,
            phone: profile?.phone || null,
          },
          assignedAt: assignment.assigned_at,
          medicationCount: patientMeds.length,
          recentAdherence: adherence,
        };
      });

      return patientDetails;
    },
    enabled: !!user,
  });

  const filteredPatients = patients?.filter((patient) => {
    const name = `${patient.profile.first_name || ""} ${patient.profile.last_name || ""}`.toLowerCase();
    const email = (patient.profile.email || "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const getAdherenceBadge = (adherence: number) => {
    if (adherence >= 80) return <Badge className="bg-green-100 text-green-700">Good ({adherence}%)</Badge>;
    if (adherence >= 60) return <Badge className="bg-amber-100 text-amber-700">Fair ({adherence}%)</Badge>;
    return <Badge className="bg-red-100 text-red-700">Low ({adherence}%)</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Roster</h1>
        <p className="text-muted-foreground">View and manage your assigned patients</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Assigned Patients</CardTitle>
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
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredPatients?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No patients match your search" : "No patients assigned yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Active Meds</TableHead>
                    <TableHead>7-Day Adherence</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
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
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(patient.assignedAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Assigned Since</span>
                </div>
                <p className="font-medium">
                  {format(new Date(selectedPatient.assignedAt), "MMMM d, yyyy")}
                </p>
              </div>

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
    </div>
  );
}
