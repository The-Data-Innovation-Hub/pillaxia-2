import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Pill, User, Clock, Send, Package, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

type PrescriptionStatus = "pending" | "sent" | "ready" | "picked_up" | "completed" | "cancelled";

interface Prescription {
  id: string;
  user_id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  prescriber: string | null;
  pharmacy: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  refills_remaining: number | null;
  prescription_status: PrescriptionStatus;
  patient: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  sent: { label: "Sent", icon: Send, variant: "outline" },
  ready: { label: "Ready for Pickup", icon: Package, variant: "default" },
  picked_up: { label: "Picked Up", icon: CheckCircle, variant: "default" },
  completed: { label: "Completed", icon: CheckCircle, variant: "default" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive" },
};

export function PrescriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ["all-prescriptions"],
    queryFn: async () => {
      const { data: medications, error } = await supabase
        .from("medications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(medications?.map((m) => m.user_id) || [])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      const prescriptionsWithPatients: Prescription[] = (medications || []).map((med) => {
        const profile = profiles?.find((p) => p.user_id === med.user_id);
        return {
          ...med,
          prescription_status: (med.prescription_status || "pending") as PrescriptionStatus,
          patient: profile
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
              }
            : null,
        };
      });

      return prescriptionsWithPatients;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, patientUserId, medicationName, pharmacy }: { 
      id: string; 
      status: PrescriptionStatus;
      patientUserId: string;
      medicationName: string;
      pharmacy?: string;
    }) => {
      const { error } = await supabase
        .from("medications")
        .update({ prescription_status: status })
        .eq("id", id);
      if (error) throw error;

      // Send notification to patient
      try {
        await supabase.functions.invoke("send-prescription-status-notification", {
          body: {
            patient_user_id: patientUserId,
            medication_name: medicationName,
            new_status: status,
            pharmacy: pharmacy,
          },
        });
      } catch (notifError) {
        console.error("Failed to send notification:", notifError);
        // Don't throw - status update succeeded, notification is secondary
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-prescriptions"] });
      toast.success("Prescription status updated & patient notified");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    const matchesSearch =
      searchQuery === "" ||
      rx.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${rx.patient?.first_name || ""} ${rx.patient?.last_name || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || rx.prescription_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = prescriptions?.reduce((acc, rx) => {
    acc[rx.prescription_status] = (acc[rx.prescription_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prescription Management</h1>
        <p className="text-muted-foreground">Track and manage prescription workflow statuses</p>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(STATUS_CONFIG) as PrescriptionStatus[]).map((status) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <Card
              key={status}
              className={`cursor-pointer transition-all ${statusFilter === status ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{statusCounts[status] || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>All Prescriptions</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient or medication..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(STATUS_CONFIG) as PrescriptionStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_CONFIG[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          ) : !filteredPrescriptions?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No prescriptions match your search" : "No prescriptions found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medication</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Prescriber</TableHead>
                    <TableHead>Refills</TableHead>
                    <TableHead>Rx Status</TableHead>
                    <TableHead>Update Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((rx) => (
                    <TableRow key={rx.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Pill className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{rx.name}</p>
                            <p className="text-xs text-muted-foreground">{rx.form}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {rx.patient?.first_name} {rx.patient?.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rx.dosage} {rx.dosage_unit}
                      </TableCell>
                      <TableCell>{rx.prescriber || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (rx.refills_remaining || 0) === 0
                              ? "destructive"
                              : (rx.refills_remaining || 0) <= 2
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {rx.refills_remaining ?? 0} left
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const config = STATUS_CONFIG[rx.prescription_status];
                          const Icon = config.icon;
                          return (
                            <Badge variant={config.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={rx.prescription_status}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({ 
                              id: rx.id, 
                              status: value as PrescriptionStatus,
                              patientUserId: rx.user_id,
                              medicationName: rx.name,
                              pharmacy: rx.pharmacy || undefined,
                            })
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50">
                            {(Object.keys(STATUS_CONFIG) as PrescriptionStatus[]).map((status) => (
                              <SelectItem key={status} value={status}>
                                {STATUS_CONFIG[status].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
