import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, User, Pill, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RefillRequest {
  id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  prescriber: string | null;
  pharmacy: string | null;
  refills_remaining: number;
  user_id: string;
  created_at: string;
  patient: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export function RefillRequestsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
  const [refillAmount, setRefillAmount] = useState("3");
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["refill-requests"],
    queryFn: async () => {
      // Get medications with 0 refills (pending refill requests)
      const { data: medications, error } = await supabase
        .from("medications")
        .select("*")
        .eq("is_active", true)
        .eq("refills_remaining", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(medications?.map((m) => m.user_id) || [])];

      // Fetch profiles for all users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, phone")
        .in("user_id", userIds);

      // Map medications with patient info
      const requestsWithPatients: RefillRequest[] = (medications || []).map((med) => {
        const profile = profiles?.find((p) => p.user_id === med.user_id);
        return {
          ...med,
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
    mutationFn: async ({ id, refills }: { id: string; refills: number }) => {
      const { error } = await supabase
        .from("medications")
        .update({ refills_remaining: refills })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refill-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacist-stats"] });
      toast.success("Refill processed successfully!");
      setSelectedRequest(null);
    },
    onError: (error) => {
      toast.error("Failed to process refill");
      console.error(error);
    },
  });

  const filteredRequests = requests?.filter((req) => {
    const matchesSearch =
      searchQuery === "" ||
      req.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${req.patient?.first_name || ""} ${req.patient?.last_name || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleProcessRefill = () => {
    if (!selectedRequest) return;
    processRefillMutation.mutate({
      id: selectedRequest.id,
      refills: parseInt(refillAmount) || 3,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Refill Requests</h1>
        <p className="text-muted-foreground">
          Process medication refill requests from patients
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold">{requests?.length || 0}</p>
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
                <p className="text-sm text-muted-foreground">Ready to Process</p>
                <p className="text-2xl font-bold">{requests?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Pending Refill Requests</CardTitle>
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
          ) : !filteredRequests?.length ? (
            <div className="text-center py-12">
              <RefreshCw className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No requests match your search" : "No pending refill requests"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Pill className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium">{request.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.dosage} {request.dosage_unit} • {request.form}
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

                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Process
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {request.prescriber && <span>Prescriber: {request.prescriber}</span>}
                    {request.pharmacy && <span>Pharmacy: {request.pharmacy}</span>}
                    <span>Requested: {format(new Date(request.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Refill Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Refill Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <Pill className="h-5 w-5 text-primary" />
                  <span className="font-medium">{selectedRequest.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedRequest.dosage} {selectedRequest.dosage_unit} • {selectedRequest.form}
                </p>
                <div className="mt-2 text-sm">
                  <span className="text-muted-foreground">Patient: </span>
                  {selectedRequest.patient?.first_name} {selectedRequest.patient?.last_name}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refill-amount">Number of Refills to Add</Label>
                <Input
                  id="refill-amount"
                  type="number"
                  min="1"
                  max="12"
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Standard refill is 3 months. Maximum allowed is 12.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleProcessRefill}
              disabled={processRefillMutation.isPending}
              className="gap-1"
            >
              <CheckCircle className="h-4 w-4" />
              {processRefillMutation.isPending ? "Processing..." : "Approve Refill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
