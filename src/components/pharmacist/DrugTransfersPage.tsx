import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Plus, Check, X, Truck, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PharmacyLocation {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface DrugTransfer {
  id: string;
  drug_name: string;
  generic_name: string | null;
  dosage: string | null;
  form: string | null;
  quantity: number;
  lot_number: string | null;
  expiry_date: string | null;
  reason: string | null;
  status: string;
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
  source_pharmacy: PharmacyLocation;
  destination_pharmacy: PharmacyLocation;
}

export function DrugTransfersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTab, setSelectedTab] = useState("incoming");
  const [formData, setFormData] = useState({
    destination_pharmacy_id: "",
    drug_name: "",
    generic_name: "",
    dosage: "",
    form: "tablet",
    quantity: "",
    lot_number: "",
    expiry_date: "",
    reason: "",
  });

  // Fetch user's pharmacy
  const { data: myPharmacy } = useQuery({
    queryKey: ["my-pharmacy", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_locations")
        .select("id, name, city, state")
        .eq("pharmacist_user_id", user?.id)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data as PharmacyLocation;
    },
    enabled: !!user?.id,
  });

  // Fetch all pharmacies for transfer destination
  const { data: allPharmacies } = useQuery({
    queryKey: ["all-pharmacies-for-transfer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_locations")
        .select("id, name, city, state")
        .eq("is_active", true)
        .neq("pharmacist_user_id", user?.id)
        .order("name");
      if (error) throw error;
      return data as PharmacyLocation[];
    },
    enabled: !!user?.id,
  });

  // Fetch transfers
  const { data: transfers, isLoading } = useQuery({
    queryKey: ["drug-transfers", myPharmacy?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drug_transfers")
        .select(`
          *,
          source_pharmacy:pharmacy_locations!drug_transfers_source_pharmacy_id_fkey (id, name, city, state),
          destination_pharmacy:pharmacy_locations!drug_transfers_destination_pharmacy_id_fkey (id, name, city, state)
        `)
        .or(`source_pharmacy_id.eq.${myPharmacy?.id},destination_pharmacy_id.eq.${myPharmacy?.id}`)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DrugTransfer[];
    },
    enabled: !!myPharmacy?.id,
  });

  const incomingTransfers = transfers?.filter(
    (t) => t.destination_pharmacy.id === myPharmacy?.id
  );
  const outgoingTransfers = transfers?.filter(
    (t) => t.source_pharmacy.id === myPharmacy?.id
  );

  const createTransferMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("drug_transfers").insert({
        source_pharmacy_id: myPharmacy?.id,
        destination_pharmacy_id: formData.destination_pharmacy_id,
        drug_name: formData.drug_name,
        generic_name: formData.generic_name || null,
        dosage: formData.dosage || null,
        form: formData.form,
        quantity: parseInt(formData.quantity),
        lot_number: formData.lot_number || null,
        expiry_date: formData.expiry_date || null,
        reason: formData.reason || null,
        requested_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drug-transfers"] });
      setShowCreateDialog(false);
      setFormData({
        destination_pharmacy_id: "",
        drug_name: "",
        generic_name: "",
        dosage: "",
        form: "tablet",
        quantity: "",
        lot_number: "",
        expiry_date: "",
        reason: "",
      });
      toast.success("Transfer request created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create transfer", { description: error.message });
    },
  });

  const updateTransferMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: {
        status: string;
        approved_by?: string;
        approved_at?: string;
        completed_by?: string;
        completed_at?: string;
        notes?: string;
      } = { status };
      
      if (status === "approved") {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      } else if (status === "completed") {
        updateData.completed_by = user?.id;
        updateData.completed_at = new Date().toISOString();
      }
      
      if (notes) updateData.notes = notes;

      const { error } = await supabase
        .from("drug_transfers")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drug-transfers"] });
      toast.success("Transfer updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update transfer", { description: error.message });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-accent text-accent-foreground";
      case "approved":
        return "bg-primary/20 text-primary";
      case "in_transit":
        return "bg-secondary text-secondary-foreground";
      case "completed":
        return "bg-green-600/20 text-green-700 dark:text-green-400";
      case "rejected":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "cancelled":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted";
    }
  };

  const renderTransferTable = (transferList: DrugTransfer[] | undefined, isIncoming: boolean) => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (!transferList?.length) {
      return (
        <p className="text-muted-foreground text-center py-8">
          No {isIncoming ? "incoming" : "outgoing"} transfers.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Drug</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>{isIncoming ? "From" : "To"}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transferList.map((transfer) => (
            <TableRow key={transfer.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{transfer.drug_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {transfer.dosage} {transfer.form}
                  </p>
                </div>
              </TableCell>
              <TableCell>{transfer.quantity}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">
                    {isIncoming ? transfer.source_pharmacy.name : transfer.destination_pharmacy.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isIncoming ? transfer.source_pharmacy.city : transfer.destination_pharmacy.city},{" "}
                    {isIncoming ? transfer.source_pharmacy.state : transfer.destination_pharmacy.state}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getStatusColor(transfer.status)}>
                  {transfer.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(transfer.requested_at), "MMM d, yyyy")}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {/* Incoming transfer actions */}
                  {isIncoming && transfer.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() =>
                          updateTransferMutation.mutate({ id: transfer.id, status: "approved" })
                        }
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive"
                        onClick={() =>
                          updateTransferMutation.mutate({ id: transfer.id, status: "rejected" })
                        }
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {isIncoming && transfer.status === "in_transit" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        updateTransferMutation.mutate({ id: transfer.id, status: "completed" })
                      }
                    >
                      <Package className="h-4 w-4" />
                      Mark Received
                    </Button>
                  )}
                  {/* Outgoing transfer actions */}
                  {!isIncoming && transfer.status === "approved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        updateTransferMutation.mutate({ id: transfer.id, status: "in_transit" })
                      }
                    >
                      <Truck className="h-4 w-4" />
                      Mark Shipped
                    </Button>
                  )}
                  {!isIncoming && transfer.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        updateTransferMutation.mutate({ id: transfer.id, status: "cancelled" })
                      }
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-8 w-8" />
            Drug Transfers
          </h1>
          <p className="text-muted-foreground">Share medications between pharmacy locations</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!myPharmacy}>
              <Plus className="h-4 w-4" />
              Request Transfer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Drug Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Destination Pharmacy *</Label>
                <Select
                  value={formData.destination_pharmacy_id}
                  onValueChange={(v) => setFormData({ ...formData, destination_pharmacy_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pharmacy" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg max-h-60">
                    {allPharmacies?.map((pharmacy) => (
                      <SelectItem key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.name} - {pharmacy.city}, {pharmacy.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Drug Name *</Label>
                  <Input
                    value={formData.drug_name}
                    onChange={(e) => setFormData({ ...formData, drug_name: e.target.value })}
                    placeholder="e.g., Metformin"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Generic Name</Label>
                  <Input
                    value={formData.generic_name}
                    onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Dosage</Label>
                  <Input
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    placeholder="e.g., 500mg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Form</Label>
                  <Select
                    value={formData.form}
                    onValueChange={(v) => setFormData({ ...formData, form: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg">
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="capsule">Capsule</SelectItem>
                      <SelectItem value="syrup">Syrup</SelectItem>
                      <SelectItem value="injection">Injection</SelectItem>
                      <SelectItem value="cream">Cream</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lot Number</Label>
                  <Input
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason for Transfer</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why is this transfer needed?"
                  rows={2}
                />
              </div>
              <Button
                onClick={() => createTransferMutation.mutate()}
                disabled={
                  !formData.destination_pharmacy_id ||
                  !formData.drug_name ||
                  !formData.quantity ||
                  createTransferMutation.isPending
                }
                className="w-full"
              >
                {createTransferMutation.isPending ? "Creating..." : "Request Transfer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!myPharmacy && (
        <Card className="border-orange-400/50 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <p className="text-orange-800 dark:text-orange-300">
              You need to set up a pharmacy location before you can manage transfers.
              Go to Medication Availability to add your pharmacy.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="incoming" className="gap-2">
                <Package className="h-4 w-4" />
                Incoming ({incomingTransfers?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="gap-2">
                <Truck className="h-4 w-4" />
                Outgoing ({outgoingTransfers?.length || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="incoming">
              {renderTransferTable(incomingTransfers, true)}
            </TabsContent>
            <TabsContent value="outgoing">
              {renderTransferTable(outgoingTransfers, false)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
