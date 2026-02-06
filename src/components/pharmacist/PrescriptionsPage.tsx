import { useState } from "react";
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
import { Search, Pill, User, Clock, Send, Package, CheckCircle, XCircle, FileText, AlertTriangle } from "lucide-react";
import { usePrescriptions, Prescription, PrescriptionStatus } from "@/hooks/usePrescriptions";

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", icon: FileText, variant: "outline" },
  pending: { label: "Pending", icon: Clock, variant: "secondary" },
  sent: { label: "Sent", icon: Send, variant: "outline" },
  received: { label: "Received", icon: CheckCircle, variant: "default" },
  processing: { label: "Processing", icon: Package, variant: "secondary" },
  ready: { label: "Ready for Pickup", icon: Package, variant: "default" },
  dispensed: { label: "Dispensed", icon: CheckCircle, variant: "default" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive" },
  expired: { label: "Expired", icon: AlertTriangle, variant: "destructive" },
};

export function PrescriptionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { prescriptions, isLoading, updatePrescriptionStatus } = usePrescriptions();

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    const matchesSearch =
      searchQuery === "" ||
      rx.medication_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rx.prescription_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${rx.patient_profile?.first_name || ""} ${rx.patient_profile?.last_name || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || rx.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = prescriptions?.reduce((acc, rx) => {
    acc[rx.status] = (acc[rx.status] || 0) + 1;
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
                    <TableHead>Rx #</TableHead>
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
                      <TableCell className="font-mono text-sm">
                        {rx.prescription_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Pill className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{rx.medication_name}</p>
                            <p className="text-xs text-muted-foreground">{rx.form}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {rx.patient_profile?.first_name} {rx.patient_profile?.last_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {rx.dosage} {rx.dosage_unit}
                      </TableCell>
                      <TableCell>
                        {rx.clinician_profile
                          ? `Dr. ${rx.clinician_profile.first_name || ""} ${rx.clinician_profile.last_name || ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rx.refills_remaining === 0
                              ? "destructive"
                              : rx.refills_remaining <= 2
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {rx.refills_remaining ?? 0} left
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const config = STATUS_CONFIG[rx.status];
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
                          value={rx.status}
                          onValueChange={(value) =>
                            updatePrescriptionStatus.mutate({
                              prescriptionId: rx.id,
                              status: value as PrescriptionStatus,
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
