import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  patient_user_id: z.string().uuid("Select a patient"),
  prescriber_user_id: z.string().uuid("Select a prescriber"),
  prescription_id: z.string().uuid("Select a prescription").optional(),
  prescriber_dea: z.string().max(20).optional(),
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
      patient_user_id: "",
      prescriber_user_id: "",
      prescription_id: undefined,
      prescriber_dea: "",
      quantity_dispensed: 1,
      notes: "",
    },
  });

  // Load patients (users with patient role)
  const { data: patients } = useQuery({
    queryKey: ["dispensing-patients"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await db
        .from("user_roles")
        .select("user_id")
        .eq("role", "patient");
      if (rolesError) throw rolesError;

      const userIds = roles?.map((r) => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds)
        .order("last_name");
      if (error) throw error;
      return profiles || [];
    },
    enabled: open,
  });

  // Load clinicians (users with clinician role)
  const { data: clinicians } = useQuery({
    queryKey: ["dispensing-clinicians"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await db
        .from("user_roles")
        .select("user_id")
        .eq("role", "clinician");
      if (rolesError) throw rolesError;

      const userIds = roles?.map((r) => r.user_id) || [];
      if (userIds.length === 0) return [];

      const { data: profiles, error } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds)
        .order("last_name");
      if (error) throw error;
      return profiles || [];
    },
    enabled: open,
  });

  // Load prescriptions for the selected patient
  const selectedPatient = form.watch("patient_user_id");
  const { data: prescriptions } = useQuery({
    queryKey: ["dispensing-prescriptions", selectedPatient],
    queryFn: async () => {
      const { data, error } = await db
        .from("prescriptions")
        .select("id, prescription_number, medication_name, dosage, status")
        .eq("patient_user_id", selectedPatient)
        .in("status", ["sent", "received", "processing", "ready"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPatient,
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
      const { error } = await db.from("controlled_drug_dispensing").insert({
        controlled_drug_id: drug.id,
        patient_user_id: values.patient_user_id,
        prescriber_user_id: values.prescriber_user_id,
        prescription_id: values.prescription_id || null,
        prescriber_dea: values.prescriber_dea || null,
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
    } catch (error: any) {
      toast.error(error.message || "Failed to record dispensing");
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
                name="patient_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border shadow-lg max-h-60">
                        {patients?.map((p) => (
                          <SelectItem key={p.user_id} value={p.user_id}>
                            {p.first_name} {p.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prescriber_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescriber *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select prescriber" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border shadow-lg max-h-60">
                        {clinicians?.map((c) => (
                          <SelectItem key={c.user_id} value={c.user_id}>
                            Dr. {c.first_name} {c.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prescription_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescription</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedPatient ? "Select Rx" : "Select patient first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border shadow-lg max-h-60">
                        {prescriptions?.map((rx) => (
                          <SelectItem key={rx.id} value={rx.id}>
                            {rx.prescription_number} - {rx.medication_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
