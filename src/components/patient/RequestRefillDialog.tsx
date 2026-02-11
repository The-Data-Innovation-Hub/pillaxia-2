import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pill, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  pharmacy: string | null;
  refills_remaining: number | null;
}

interface RequestRefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medication: Medication | null;
  onSuccess?: () => void;
}

export function RequestRefillDialog({
  open,
  onOpenChange,
  medication,
  onSuccess,
}: RequestRefillDialogProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!medication || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("refill_requests").insert({
        patient_user_id: user.id,
        medication_id: medication.id,
        patient_notes: notes.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Refill request submitted", {
        description: "Your pharmacy will review your request shortly.",
      });
      setNotes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      console.error("Error submitting refill request:", error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error("Failed to submit refill request", {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setNotes("");
      onOpenChange(false);
    }
  };

  if (!medication) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Request Refill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Medication Info */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Pill className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{medication.name}</p>
                <p className="text-sm text-muted-foreground">
                  {medication.dosage} {medication.dosage_unit} • {medication.form}
                </p>
                {medication.pharmacy && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Pharmacy: {medication.pharmacy}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0">
                {medication.refills_remaining ?? 0} refills left
              </Badge>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or urgency notes for your pharmacist..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Include any relevant information like running low, travel plans, etc.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
