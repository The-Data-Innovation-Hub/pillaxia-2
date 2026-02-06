import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AlertTriangle, Plus, Bell, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DrugRecall {
  id: string;
  drug_name: string;
  generic_name: string | null;
  lot_numbers: string[];
  manufacturer: string | null;
  recall_reason: string;
  recall_class: string;
  recall_date: string;
  instructions: string | null;
  fda_reference: string | null;
  is_active: boolean;
  created_at: string;
}

export function DrugRecallsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    drug_name: "",
    generic_name: "",
    lot_numbers: "",
    manufacturer: "",
    recall_reason: "",
    recall_class: "Class II",
    instructions: "",
    fda_reference: "",
  });

  const { data: recalls, isLoading } = useQuery({
    queryKey: ["drug-recalls"],
    queryFn: async () => {
      const { data, error } = await db
        .from("drug_recalls")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DrugRecall[];
    },
  });

  const createRecallMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.from("drug_recalls").insert({
        drug_name: formData.drug_name,
        generic_name: formData.generic_name || null,
        lot_numbers: formData.lot_numbers.split(",").map((l) => l.trim()).filter(Boolean),
        manufacturer: formData.manufacturer || null,
        recall_reason: formData.recall_reason,
        recall_class: formData.recall_class,
        instructions: formData.instructions || null,
        fda_reference: formData.fda_reference || null,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["drug-recalls"] });
      setShowCreateDialog(false);
      setFormData({
        drug_name: "",
        generic_name: "",
        lot_numbers: "",
        manufacturer: "",
        recall_reason: "",
        recall_class: "Class II",
        instructions: "",
        fda_reference: "",
      });
      toast.success("Drug recall created", {
        description: "Would you like to send notifications?",
        action: {
          label: "Send Alerts",
          onClick: () => sendAlertsMutation.mutate(data.id),
        },
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to create recall", { description: error.message });
    },
  });

  const sendAlertsMutation = useMutation({
    mutationFn: async (recallId: string) => {
      const { data, error } = await db.functions.invoke("send-drug-recall-alert", {
        body: { recall_id: recallId, notify_pharmacies: true, notify_patients: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Recall alerts sent", {
        description: `Notified ${data.notifications_sent.pharmacies} pharmacies and ${data.notifications_sent.patients} patients`,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to send alerts", { description: error.message });
    },
  });

  const toggleRecallMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await db
        .from("drug_recalls")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drug-recalls"] });
      toast.success("Recall status updated");
    },
  });

  const getRecallClassColor = (recallClass: string) => {
    switch (recallClass) {
      case "Class I":
        return "bg-destructive text-destructive-foreground";
      case "Class II":
        return "bg-orange-500 text-white";
      case "Class III":
        return "bg-yellow-500 text-black";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Drug Recalls
          </h1>
          <p className="text-muted-foreground">Manage drug recall alerts and notifications</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Recall Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Drug Recall Alert</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Drug Name *</Label>
                  <Input
                    value={formData.drug_name}
                    onChange={(e) => setFormData({ ...formData, drug_name: e.target.value })}
                    placeholder="e.g., Metformin 500mg"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Generic Name</Label>
                  <Input
                    value={formData.generic_name}
                    onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                    placeholder="e.g., Metformin"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recall Class *</Label>
                  <Select
                    value={formData.recall_class}
                    onValueChange={(v) => setFormData({ ...formData, recall_class: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg">
                      <SelectItem value="Class I">Class I (Most Serious)</SelectItem>
                      <SelectItem value="Class II">Class II (Moderate)</SelectItem>
                      <SelectItem value="Class III">Class III (Least Serious)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Input
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="Manufacturer name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lot Numbers (comma-separated)</Label>
                <Input
                  value={formData.lot_numbers}
                  onChange={(e) => setFormData({ ...formData, lot_numbers: e.target.value })}
                  placeholder="e.g., LOT123, LOT456, LOT789"
                />
              </div>
              <div className="space-y-2">
                <Label>Recall Reason *</Label>
                <Textarea
                  value={formData.recall_reason}
                  onChange={(e) => setFormData({ ...formData, recall_reason: e.target.value })}
                  placeholder="Describe the reason for the recall..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Patient Instructions</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="What should patients do?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>FDA/NAFDAC Reference</Label>
                <Input
                  value={formData.fda_reference}
                  onChange={(e) => setFormData({ ...formData, fda_reference: e.target.value })}
                  placeholder="Reference number or URL"
                />
              </div>
              <Button
                onClick={() => createRecallMutation.mutate()}
                disabled={!formData.drug_name || !formData.recall_reason || createRecallMutation.isPending}
                className="w-full"
              >
                {createRecallMutation.isPending ? "Creating..." : "Create Recall Alert"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Recalls</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !recalls?.length ? (
            <p className="text-muted-foreground text-center py-8">
              No drug recalls recorded. Create one to alert pharmacies and patients.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recalls.map((recall) => (
                  <TableRow key={recall.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{recall.drug_name}</p>
                        {recall.manufacturer && (
                          <p className="text-sm text-muted-foreground">{recall.manufacturer}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRecallClassColor(recall.recall_class)}>
                        {recall.recall_class}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {recall.recall_reason}
                    </TableCell>
                    <TableCell>{format(new Date(recall.recall_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant={recall.is_active ? "default" : "secondary"}>
                        {recall.is_active ? "Active" : "Resolved"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => sendAlertsMutation.mutate(recall.id)}
                          disabled={sendAlertsMutation.isPending}
                        >
                          <Bell className="h-4 w-4" />
                          Send Alerts
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleRecallMutation.mutate({
                              id: recall.id,
                              isActive: !recall.is_active,
                            })
                          }
                        >
                          {recall.is_active ? "Resolve" : "Reactivate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
