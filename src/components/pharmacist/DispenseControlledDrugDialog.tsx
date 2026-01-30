import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ControlledDrug {
  id: string;
  name: string;
  schedule: "II" | "III" | "IV" | "V";
  strength: string;
  form: string;
  current_stock: number;
  unit_of_measure: string;
}

const formSchema = z.object({
  patient_name: z.string().min(1, "Patient name is required").max(200),
  patient_id: z.string().max(100).optional(),
  prescriber_name: z.string().min(1, "Prescriber name is required").max(200),
  prescriber_dea: z.string().max(20).optional(),
  prescription_number: z.string().min(1, "Prescription number is required").max(50),
  quantity_dispensed: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface DispenseControlledDrugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drug: ControlledDrug;
  onSuccess: () => void;
}

export function DispenseControlledDrugDialog({
  open,
  onOpenChange,
  drug,
  onSuccess,
}: DispenseControlledDrugDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_name: "",
      patient_id: "",
      prescriber_name: "",
      prescriber_dea: "",
      prescription_number: "",
      quantity_dispensed: 1,
      notes: "",
    },
  });

  const watchedQuantity = form.watch("quantity_dispensed") || 0;
  const remainingStock = drug.current_stock - watchedQuantity;

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    if (values.quantity_dispensed > drug.current_stock) {
      toast.error("Insufficient stock for this quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("controlled_drug_dispensing").insert({
        controlled_drug_id: drug.id,
        patient_name: values.patient_name,
        patient_id: values.patient_id || null,
        prescriber_name: values.prescriber_name,
        prescriber_dea: values.prescriber_dea || null,
        prescription_number: values.prescription_number,
        quantity_dispensed: values.quantity_dispensed,
        quantity_remaining: remainingStock,
        dispensing_pharmacist_id: user.id,
        notes: values.notes || null,
      });

      if (error) throw error;

      toast.success(`Dispensed ${values.quantity_dispensed} ${drug.unit_of_measure} of ${drug.name}`);
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(errMsg || "Failed to record dispensing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScheduleColor = (schedule: string) => {
    const colors: Record<string, string> = {
      "II": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      "III": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      "IV": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      "V": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return colors[schedule] || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispense Controlled Substance</DialogTitle>
          <DialogDescription>
            Record dispensing of {drug.name} ({drug.strength} {drug.form})
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
          <div className="flex-1">
            <p className="font-medium">{drug.name}</p>
            <p className="text-sm text-muted-foreground">{drug.strength} {drug.form}</p>
          </div>
          <Badge className={getScheduleColor(drug.schedule)}>Schedule {drug.schedule}</Badge>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Stock</p>
            <p className="font-bold">{drug.current_stock} {drug.unit_of_measure}</p>
          </div>
        </div>

        {remainingStock < 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Insufficient stock. Only {drug.current_stock} {drug.unit_of_measure} available.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="patient_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient ID</FormLabel>
                    <FormControl>
                      <Input placeholder="ID or DOB" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prescriber_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescriber Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Full Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prescriber_dea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescriber DEA #</FormLabel>
                    <FormControl>
                      <Input placeholder="AB1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prescription_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rx Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="RX-123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity_dispensed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Dispense *</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max={drug.current_stock} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">Remaining after dispensing:</span>
              <span className={`font-bold ${remainingStock < 0 ? "text-destructive" : ""}`}>
                {remainingStock} {drug.unit_of_measure}
              </span>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes for the record..." 
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || remainingStock < 0}
              >
                {isSubmitting ? "Recording..." : "Record Dispensing"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
