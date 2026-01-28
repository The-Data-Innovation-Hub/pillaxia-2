import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Loader2, MapPin, Phone, Mail, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Prescription } from "@/hooks/usePrescriptions";

interface SendPrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: Prescription;
}

export function SendPrescriptionDialog({
  open,
  onOpenChange,
  prescription,
}: SendPrescriptionDialogProps) {
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>(
    prescription.pharmacy_id || ""
  );
  const queryClient = useQueryClient();

  const { data: pharmacies, isLoading } = useQuery({
    queryKey: ["pharmacies-for-send"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_locations")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sendPrescription = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-prescription", {
        body: {
          prescriptionId: prescription.id,
          pharmacyId: selectedPharmacyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription sent", {
        description: data.message || "The prescription has been sent to the pharmacy",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to send prescription", {
        description: error.message,
      });
    },
  });

  const selectedPharmacy = pharmacies?.find((p) => p.id === selectedPharmacyId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Prescription
          </DialogTitle>
          <DialogDescription>
            Send Rx #{prescription.prescription_number} for{" "}
            <span className="font-medium">{prescription.medication_name}</span> to a pharmacy
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {prescription.is_controlled_substance && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is a Schedule {prescription.dea_schedule} controlled substance.
                Additional verification may be required.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Select Pharmacy</Label>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : pharmacies && pharmacies.length > 0 ? (
              <RadioGroup
                value={selectedPharmacyId}
                onValueChange={setSelectedPharmacyId}
                className="space-y-2 max-h-64 overflow-y-auto"
              >
                {pharmacies.map((pharmacy) => (
                  <div
                    key={pharmacy.id}
                    className={`flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedPharmacyId === pharmacy.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedPharmacyId(pharmacy.id)}
                  >
                    <RadioGroupItem value={pharmacy.id} id={pharmacy.id} className="mt-1" />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={pharmacy.id} className="font-medium cursor-pointer">
                        {pharmacy.name}
                      </Label>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {pharmacy.city}, {pharmacy.state}
                        </div>
                        {pharmacy.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {pharmacy.phone}
                          </div>
                        )}
                        {pharmacy.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {pharmacy.email}
                          </div>
                        )}
                      </div>
                      {!pharmacy.email && (
                        <div className="text-xs text-destructive">
                          No email configured - cannot send electronically
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No pharmacies available</p>
                <p className="text-sm">Please add a pharmacy first</p>
              </div>
            )}
          </div>

          {selectedPharmacy && !selectedPharmacy.email && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This pharmacy does not have an email address configured. 
                Electronic prescription transmission is not available.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendPrescription.mutate()}
            disabled={
              !selectedPharmacyId ||
              !selectedPharmacy?.email ||
              sendPrescription.isPending
            }
          >
            {sendPrescription.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Prescription
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
