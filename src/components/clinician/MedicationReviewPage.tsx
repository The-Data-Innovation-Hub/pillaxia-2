import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, Pill, User, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

interface PatientMedication {
  patientId: string;
  patientName: string;
  medications: {
    id: string;
    name: string;
    dosage: string;
    dosage_unit: string;
    form: string;
    instructions: string | null;
    prescriber: string | null;
    pharmacy: string | null;
    start_date: string | null;
    is_active: boolean;
    schedules: {
      time_of_day: string;
      quantity: number;
      with_food: boolean | null;
    }[];
  }[];
}

export function MedicationReviewPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPatient, setFilterPatient] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["clinician-medications", user?.id],
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

      // Get medications with schedules
      const { data: medications } = await supabase
        .from("medications")
        .select(`
          *,
          medication_schedules (
            time_of_day,
            quantity,
            with_food,
            is_active
          )
        `)
        .in("user_id", patientIds)
        .eq("is_active", true);

      // Group by patient
      const patientMeds: PatientMedication[] = patientIds.map((patientId) => {
        const profile = profiles?.find((p) => p.user_id === patientId);
        const patientMedications = medications?.filter((m) => m.user_id === patientId) || [];

        return {
          patientId,
          patientName: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Unknown",
          medications: patientMedications.map((med) => ({
            id: med.id,
            name: med.name,
            dosage: med.dosage,
            dosage_unit: med.dosage_unit,
            form: med.form,
            instructions: med.instructions,
            prescriber: med.prescriber,
            pharmacy: med.pharmacy,
            start_date: med.start_date,
            is_active: med.is_active,
            schedules: (med.medication_schedules || [])
              .filter((s: { is_active: boolean }) => s.is_active)
              .map((s: { time_of_day: string; quantity: number; with_food: boolean | null }) => ({
                time_of_day: s.time_of_day,
                quantity: s.quantity,
                with_food: s.with_food,
              })),
          })),
        };
      });

      return patientMeds.filter((p) => p.medications.length > 0);
    },
    enabled: !!user,
  });

  const filteredData = data?.filter((patient) => {
    const matchesPatient = filterPatient === "all" || patient.patientId === filterPatient;
    const matchesSearch =
      searchQuery === "" ||
      patient.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.medications.some((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPatient && matchesSearch;
  });

  const totalMedications = data?.reduce((acc, p) => acc + p.medications.length, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Medication Review</h1>
        <p className="text-muted-foreground">Review medications for your assigned patients</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Pill className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Medications</p>
                <p className="text-2xl font-bold">{totalMedications}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <User className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patients on Meds</p>
                <p className="text-2xl font-bold">{data?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg per Patient</p>
                <p className="text-2xl font-bold">
                  {data?.length ? (totalMedications / data.length).toFixed(1) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Medications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient or medication..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPatient} onValueChange={setFilterPatient}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by patient" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Patients</SelectItem>
                {data?.map((patient) => (
                  <SelectItem key={patient.patientId} value={patient.patientId}>
                    {patient.patientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !filteredData?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No medications match your search" : "No medications found"}
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filteredData.map((patient) => (
                <AccordionItem
                  key={patient.patientId}
                  value={patient.patientId}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{patient.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {patient.medications.length} active medication
                          {patient.medications.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {patient.medications.map((med) => (
                        <div
                          key={med.id}
                          className="p-4 rounded-lg bg-muted/50 space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                <Pill className="h-4 w-4 text-primary" />
                                {med.name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {med.dosage} {med.dosage_unit} • {med.form}
                              </p>
                            </div>
                            <Badge variant="secondary">{med.schedules.length} doses/day</Badge>
                          </div>

                          {med.schedules.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {med.schedules.map((schedule, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {schedule.time_of_day.slice(0, 5)} • {schedule.quantity}{" "}
                                  {med.form}
                                  {schedule.with_food && " • with food"}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {med.instructions && (
                            <div className="flex items-start gap-2 text-sm">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <p className="text-muted-foreground">{med.instructions}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {med.prescriber && <span>Prescriber: {med.prescriber}</span>}
                            {med.pharmacy && <span>Pharmacy: {med.pharmacy}</span>}
                            {med.start_date && (
                              <span>Started: {format(new Date(med.start_date), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
