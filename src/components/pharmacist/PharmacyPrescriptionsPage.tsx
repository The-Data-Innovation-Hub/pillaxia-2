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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Search,
  MoreHorizontal,
  Eye,
  Clock,
  CheckCircle,
  Package,
  AlertTriangle,
  Pill,
  XCircle,
  Send,
  Download,
  Loader2,
} from "lucide-react";
import { usePrescriptions, Prescription, PrescriptionStatus } from "@/hooks/usePrescriptions";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
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

const NEXT_STATUS: Record<string, { status: PrescriptionStatus; label: string }> = {
  sent: { status: 'received', label: 'Mark as Received' },
  received: { status: 'processing', label: 'Start Processing' },
  processing: { status: 'ready', label: 'Mark as Ready' },
  ready: { status: 'dispensed', label: 'Mark as Dispensed' },
};

export function PharmacyPrescriptionsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"incoming" | "processing" | "completed">("incoming");
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [statusNotes, setStatusNotes] = useState("");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<PrescriptionStatus | null>(null);

  // Get all pharmacies managed by this pharmacist
  const { data: pharmacies } = useQuery({
    queryKey: ["my-pharmacies", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("pharmacy_locations")
        .select("id, name")
        .eq("pharmacist_user_id", user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const pharmacyIds = pharmacies?.map(p => p.id) || [];
  const pharmacyName = pharmacies && pharmacies.length === 1 
    ? pharmacies[0].name 
    : pharmacies && pharmacies.length > 1 
      ? `${pharmacies.length} pharmacies`
      : "your pharmacy";

  const statusFilter: PrescriptionStatus[] = 
    activeTab === "incoming" ? ["sent", "received"] :
    activeTab === "processing" ? ["processing", "ready"] :
    ["dispensed", "cancelled", "expired"];

  const { prescriptions, isLoading, updatePrescriptionStatus } = usePrescriptions({
    pharmacyIds: pharmacyIds.length > 0 ? pharmacyIds : undefined,
    status: statusFilter,
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

  const handleStatusUpdate = async () => {
    if (!selectedRx || !nextStatus) return;

    await updatePrescriptionStatus.mutateAsync({
      prescriptionId: selectedRx.id,
      status: nextStatus,
      notes: statusNotes || undefined,
    });

    setStatusDialogOpen(false);
    setSelectedRx(null);
    setStatusNotes("");
    setNextStatus(null);
  };

  const openStatusDialog = (rx: Prescription, status: PrescriptionStatus) => {
    setSelectedRx(rx);
    setNextStatus(status);
    setStatusDialogOpen(true);
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
      <div>
        <h1 className="text-2xl font-bold">E-Prescriptions</h1>
        <p className="text-muted-foreground">
          Manage incoming electronic prescriptions for {pharmacyName}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incoming Today</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => 
                rx.sent_at && new Date(rx.sent_at).toDateString() === new Date().toDateString()
              ).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting Processing</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => ['sent', 'received'].includes(rx.status)).length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ready for Pickup</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => rx.status === 'ready').length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dispensed Today</CardDescription>
            <CardTitle className="text-2xl">
              {prescriptions?.filter(rx => 
                rx.dispensed_at && new Date(rx.dispensed_at).toDateString() === new Date().toDateString()
              ).length || 0}
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
              <TabsTrigger value="incoming">Incoming</TabsTrigger>
              <TabsTrigger value="processing">Processing</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
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
                        <TableHead>Qty</TableHead>
                        <TableHead>Prescriber</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Received</TableHead>
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
                            <div>
                              <p className="font-medium">
                                {rx.patient_profile?.first_name} {rx.patient_profile?.last_name}
                              </p>
                              {rx.patient_profile?.phone && (
                                <p className="text-xs text-muted-foreground">{rx.patient_profile.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{rx.medication_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {rx.dosage} {rx.dosage_unit} {rx.form}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{rx.quantity}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">
                                Dr. {rx.clinician_profile?.first_name} {rx.clinician_profile?.last_name}
                              </p>
                              {rx.clinician_profile?.license_number && (
                                <p className="text-xs text-muted-foreground">
                                  Lic: {rx.clinician_profile.license_number}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{renderStatusBadge(rx.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {rx.received_at 
                              ? format(new Date(rx.received_at), "MMM d, h:mm a")
                              : rx.sent_at 
                                ? format(new Date(rx.sent_at), "MMM d, h:mm a")
                                : "—"
                            }
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
                                <DropdownMenuItem>
                                  <Download className="h-4 w-4 mr-2" />
                                  Print Label
                                </DropdownMenuItem>
                                {NEXT_STATUS[rx.status] && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openStatusDialog(rx, NEXT_STATUS[rx.status].status)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      {NEXT_STATUS[rx.status].label}
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
                    {searchQuery ? "Try adjusting your search" : "No prescriptions in this category"}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Prescription Status</DialogTitle>
            <DialogDescription>
              {selectedRx && (
                <>
                  Update Rx #{selectedRx.prescription_number} for {selectedRx.medication_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedRx?.status}</Badge>
              <span>→</span>
              <Badge variant="default">{nextStatus}</Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this status change..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={updatePrescriptionStatus.isPending}>
              {updatePrescriptionStatus.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
