import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  RefreshCw,
  User,
  Pill,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface RefillRequest {
  id: string;
  patient_user_id: string;
  medication_id: string;
  status: string;
  patient_notes: string | null;
  pharmacist_notes: string | null;
  refills_granted: number | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  medications: {
    name: string;
    dosage: string;
    dosage_unit: string;
    form: string;
    pharmacy: string | null;
  } | null;
  patient: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export function RefillRequestsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "deny" | null>(null);
  const [refillAmount, setRefillAmount] = useState("3");
  const [pharmacistNotes, setPharmacistNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["pharmacist-refill-requests"],
    queryFn: async () => {
      // Get all pending refill requests
      const { data: refillRequests, error } = await supabase
        .from("refill_requests")
        .select(`
          id,
          patient_user_id,
          medication_id,
          status,
          patient_notes,
          pharmacist_notes,
          refills_granted,
          created_at,
          resolved_at,
          resolved_by,
          medications (name, dosage, dosage_unit, form, pharmacy)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique patient IDs
      const patientIds = [...new Set(refillRequests?.map((r) => r.patient_user_id) || [])];

      // Fetch patient profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, phone")
        .in("user_id", patientIds);

      // Map requests with patient info
      const requestsWithPatients: RefillRequest[] = (refillRequests || []).map((req) => {
        const profile = profiles?.find((p) => p.user_id === req.patient_user_id);
        return {
          ...req,
          patient: profile
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
                phone: profile.phone,
              }
            : null,
        };
      });

      return requestsWithPatients;
    },
  });

  const processRefillMutation = useMutation({
    mutationFn: async ({
      requestId,
      medicationId,
      patientUserId,
      medicationName,
      status,
      refillsGranted,
      notes,
    }: {
      requestId: string;
      medicationId: string;
      patientUserId: string;
      medicationName: string;
      status: "approved" | "denied";
      refillsGranted?: number;
      notes?: string;
    }) => {
      // Update the refill request
      const { error: requestError } = await supabase
        .from("refill_requests")
        .update({
          status,
          pharmacist_notes: notes || null,
          refills_granted: status === "approved" ? refillsGranted : null,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", requestId);

      if (requestError) throw requestError;

      // If approved, update medication refills_remaining
      if (status === "approved" && refillsGranted) {
        const { error: medError } = await supabase
          .from("medications")
          .update({ refills_remaining: refillsGranted })
          .eq("id", medicationId);

        if (medError) throw medError;
      }

      // Send notification to patient
      try {
        await supabase.functions.invoke("send-refill-request-notification", {
          body: {
            patient_user_id: patientUserId,
            medication_name: medicationName,
            status,
            refills_granted: refillsGranted,
            pharmacist_notes: notes,
          },
        });
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pharmacist-refill-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacist-stats"] });
      toast.success(
        variables.status === "approved"
          ? "Refill request approved!"
          : "Refill request denied"
      );
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to process refill request");
      console.error(error);
    },
  });

  const handleCloseDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setRefillAmount("3");
    setPharmacistNotes("");
  };

  const handleAction = (request: RefillRequest, action: "approve" | "deny") => {
    setSelectedRequest(request);
    setActionType(action);
  };

  const handleSubmit = () => {
    if (!selectedRequest || !actionType) return;
    processRefillMutation.mutate({
      requestId: selectedRequest.id,
      medicationId: selectedRequest.medication_id,
      patientUserId: selectedRequest.patient_user_id,
      medicationName: selectedRequest.medications?.name || "Medication",
      status: actionType === "approve" ? "approved" : "denied",
      refillsGranted: actionType === "approve" ? parseInt(refillAmount) || 3 : undefined,
      notes: pharmacistNotes.trim() || undefined,
    });
  };

  const pendingRequests = requests?.filter((r) => r.status === "pending") || [];
  const processedRequests = requests?.filter((r) => r.status !== "pending") || [];

  const filteredPending = pendingRequests.filter((req) => {
    const matchesSearch =
      searchQuery === "" ||
      req.medications?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${req.patient?.first_name || ""} ${req.patient?.last_name || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700 gap-1">
            <XCircle className="h-3 w-3" />
            Denied
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Refill Requests</h1>
        <p className="text-muted-foreground">
          Review and process patient refill requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved Today</p>
                <p className="text-2xl font-bold">
                  {processedRequests.filter(
                    (r) =>
                      r.status === "approved" &&
                      r.resolved_at &&
                      new Date(r.resolved_at).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Processed</p>
                <p className="text-2xl font-bold">{processedRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Pending Requests</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
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
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !filteredPending.length ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No requests match your search" : "All caught up! No pending requests."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPending.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Pill className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{request.medications?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.medications?.dosage} {request.medications?.dosage_unit} •{" "}
                          {request.medications?.form}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {request.patient?.first_name} {request.patient?.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.patient?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => handleAction(request, "deny")}
                      >
                        <XCircle className="h-4 w-4" />
                        Deny
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => handleAction(request, "approve")}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {request.medications?.pharmacy && (
                      <span>Pharmacy: {request.medications.pharmacy}</span>
                    )}
                    <span>Requested: {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                  </div>

                  {request.patient_notes && (
                    <div className="mt-3 p-2 rounded bg-muted/50 text-sm flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground italic">"{request.patient_notes}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Processed */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {processedRequests.slice(0, 10).map((request) => (
                <div
                  key={request.id}
                  className="p-3 rounded-lg border flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <Pill className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{request.medications?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {request.patient?.first_name} {request.patient?.last_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {request.status === "approved" && request.refills_granted && (
                      <span className="text-xs text-muted-foreground">
                        +{request.refills_granted} refills
                      </span>
                    )}
                    {getStatusBadge(request.status)}
                    {request.resolved_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(request.resolved_at), "MMM d")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Dialog */}
      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "approve" ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Approve Refill Request
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Deny Refill Request
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-2">
                  <Pill className="h-5 w-5 text-primary" />
                  <span className="font-medium">{selectedRequest.medications?.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.medications?.dosage} {selectedRequest.medications?.dosage_unit} •{" "}
                  {selectedRequest.medications?.form}
                </p>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">Patient: </span>
                  {selectedRequest.patient?.first_name} {selectedRequest.patient?.last_name}
                </div>
              </div>

              {actionType === "approve" && (
                <div className="space-y-2">
                  <Label htmlFor="refill-amount">Number of Refills to Grant</Label>
                  <Input
                    id="refill-amount"
                    type="number"
                    min="1"
                    max="12"
                    value={refillAmount}
                    onChange={(e) => setRefillAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard refill is 3. Maximum allowed is 12.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">
                  {actionType === "approve" ? "Notes (optional)" : "Reason for Denial"}
                </Label>
                <Textarea
                  id="notes"
                  value={pharmacistNotes}
                  onChange={(e) => setPharmacistNotes(e.target.value)}
                  placeholder={
                    actionType === "approve"
                      ? "Any notes for the patient..."
                      : "Please provide a reason for denying this request..."
                  }
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={processRefillMutation.isPending}
              variant={actionType === "deny" ? "destructive" : "default"}
              className="gap-1"
            >
              {processRefillMutation.isPending ? (
                "Processing..."
              ) : actionType === "approve" ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Deny
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
