import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Search,
  MoreHorizontal,
  Send,
  Eye,
  XCircle,
  Clock,
  CheckCircle,
  Package,
  AlertTriangle,
  Plus,
  Pill,
} from "lucide-react";
import { usePrescriptions, Prescription, PrescriptionStatus } from "@/hooks/usePrescriptions";
import { CreatePrescriptionDialog } from "./CreatePrescriptionDialog";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Draft", variant: "outline", icon: <FileText className="h-3 w-3" /> },
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  sent: { label: "Sent", variant: "default", icon: <Send className="h-3 w-3" /> },
  received: { label: "Received", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  processing: { label: "Processing", variant: "secondary", icon: <Package className="h-3 w-3" /> },
  ready: { label: "Ready", variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
  dispensed: { label: "Dispensed", variant: "default", icon: <Pill className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  expired: { label: "Expired", variant: "destructive", icon: <AlertTriangle className="h-3 w-3" /> },
};

export function EPrescribingPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "all">("active");

  const statusFilter: PrescriptionStatus[] | undefined = 
    activeTab === "active" ? ["draft", "pending", "sent", "received", "processing", "ready"] :
    activeTab === "completed" ? ["dispensed", "cancelled", "expired"] :
    undefined;

  const { prescriptions, isLoading, sendPrescription, cancelPrescription } = usePrescriptions({
    status: statusFilter,
  });

  // Fetch assigned patients
  const { data: patients } = useQuery({
    queryKey: ["assigned-patients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinician_patient_assignments")
        .select(`
          patient_user_id,
          patient_profile:profiles!clinician_patient_assignments_patient_user_id_fkey(
            user_id, first_name, last_name, email
          )
        `)
        .eq("clinician_user_id", user?.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filteredPrescriptions = prescriptions?.filter((rx) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rx.medication_name.toLowerCase().includes(query) ||
      rx.prescription_number.toLowerCase().includes(query) ||
      rx.patient_profile?.first_name?.toLowerCase().includes(query) ||
      rx.patient_profile?.last_name?.toLowerCase().includes(query)
    );
  });

  const handleNewPrescription = (patientId: string, patientName: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setCreateDialogOpen(true);
  };

  const renderStatusBadge = (status: PrescriptionStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">E-Prescribing</h1>
          <p className="text-muted-foreground">Create and manage electronic prescriptions</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Prescription
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {patients && patients.length > 0 ? (
              patients.map((assignment: any) => (
                <DropdownMenuItem
                  key={assignment.patient_user_id}
                  onClick={() => handleNewPrescription(
                    assignment.patient_user_id,
                    `${assignment.patient_profile?.first_name || ''} ${assignment.patient_profile?.last_name || ''}`.trim() || 'Patient'
                  )}
                >
                  {assignment.patient_profile?.first_name} {assignment.patient_profile?.last_name}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>
                No assigned patients
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => ['draft', 'pending'].includes(rx.status)).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent Today</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => 
                rx.sent_at && new Date(rx.sent_at).toDateString() === new Date().toDateString()
              ).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Processing</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => ['sent', 'received', 'processing'].includes(rx.status)).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dispensed This Week</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => {
                if (!rx.dispensed_at) return false;
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(rx.dispensed_at) > weekAgo;
              }).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Prescriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by medication, Rx number, or patient..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredPrescriptions && filteredPrescriptions.length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rx #</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Medication</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pharmacy</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrescriptions.map((rx) => (
                        <TableRow key={rx.id}>
                          <TableCell className="font-mono text-sm">
                            {rx.prescription_number}
                            {rx.is_controlled_substance && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                C{rx.dea_schedule}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {rx.patient_profile?.first_name} {rx.patient_profile?.last_name}
                          </TableCell>
                          <TableCell className="font-medium">{rx.medication_name}</TableCell>
                          <TableCell>
                            {rx.dosage} {rx.dosage_unit}
                          </TableCell>
                          <TableCell>{renderStatusBadge(rx.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {rx.pharmacy?.name || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(rx.date_written), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {rx.status === 'draft' && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      // Would open pharmacy selection
                                    }}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send to Pharmacy
                                  </DropdownMenuItem>
                                )}
                                {!['dispensed', 'cancelled', 'expired'].includes(rx.status) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => cancelPrescription.mutate({
                                        prescriptionId: rx.id,
                                        reason: "Cancelled by prescriber",
                                      })}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel Prescription
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium">No prescriptions found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Try adjusting your search" : "Create a new prescription to get started"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Prescription Dialog */}
      {selectedPatientId && (
        <CreatePrescriptionDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          patientId={selectedPatientId}
          patientName={selectedPatientName}
        />
      )}
    </div>
  );
}
