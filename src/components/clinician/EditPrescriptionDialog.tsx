import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import { usePrescriptions, Prescription } from "@/hooks/usePrescriptions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const prescriptionSchema = z.object({
  medication_name: z.string().min(1, "Medication name is required").max(200),
  generic_name: z.string().max(200).optional(),
  dosage: z.string().min(1, "Dosage is required").max(50),
  dosage_unit: z.string().min(1, "Unit is required"),
  form: z.string().min(1, "Form is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1").max(1000),
  refills_authorized: z.coerce.number().min(0).max(12).default(0),
  sig: z.string().min(1, "Directions are required").max(500),
  instructions: z.string().max(1000).optional(),
  pharmacy_id: z.string().optional(),
  is_controlled_substance: z.boolean().default(false),
  dea_schedule: z.string().optional(),
  dispense_as_written: z.boolean().default(false),
  diagnosis_code: z.string().max(20).optional(),
  diagnosis_description: z.string().max(200).optional(),
});

type PrescriptionFormData = z.infer<typeof prescriptionSchema>;

interface EditPrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: Prescription;
}

const DOSAGE_UNITS = ["mg", "mcg", "g", "mL", "units", "IU", "mg/mL", "%"];
const FORMS = ["tablet", "capsule", "liquid", "injection", "cream", "ointment", "patch", "inhaler", "drops", "suppository"];
const DEA_SCHEDULES = ["II", "III", "IV", "V"];

export function EditPrescriptionDialog({
  open,
  onOpenChange,
  prescription,
}: EditPrescriptionDialogProps) {
  const { updatePrescription } = usePrescriptions();

  // Fetch available pharmacies
  const { data: pharmacies } = useQuery({
    queryKey: ["pharmacies-for-prescription"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_locations")
        .select("id, name, city, state")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<PrescriptionFormData>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      medication_name: prescription.medication_name,
      generic_name: prescription.generic_name || "",
      dosage: prescription.dosage,
      dosage_unit: prescription.dosage_unit,
      form: prescription.form,
      quantity: prescription.quantity,
      refills_authorized: prescription.refills_authorized,
      sig: prescription.sig,
      instructions: prescription.instructions || "",
      pharmacy_id: prescription.pharmacy_id || undefined,
      is_controlled_substance: prescription.is_controlled_substance,
      dea_schedule: prescription.dea_schedule || undefined,
      dispense_as_written: prescription.dispense_as_written,
      diagnosis_code: prescription.diagnosis_code || "",
      diagnosis_description: prescription.diagnosis_description || "",
    },
  });

  // Reset form when prescription changes
  useEffect(() => {
    form.reset({
      medication_name: prescription.medication_name,
      generic_name: prescription.generic_name || "",
      dosage: prescription.dosage,
      dosage_unit: prescription.dosage_unit,
      form: prescription.form,
      quantity: prescription.quantity,
      refills_authorized: prescription.refills_authorized,
      sig: prescription.sig,
      instructions: prescription.instructions || "",
      pharmacy_id: prescription.pharmacy_id || undefined,
      is_controlled_substance: prescription.is_controlled_substance,
      dea_schedule: prescription.dea_schedule || undefined,
      dispense_as_written: prescription.dispense_as_written,
      diagnosis_code: prescription.diagnosis_code || "",
      diagnosis_description: prescription.diagnosis_description || "",
    });
  }, [prescription, form]);

  const isControlled = form.watch("is_controlled_substance");

  const onSubmit = async (data: PrescriptionFormData) => {
    await updatePrescription.mutateAsync({
      prescriptionId: prescription.id,
      data: {
        medication_name: data.medication_name,
        generic_name: data.generic_name,
        dosage: data.dosage,
        dosage_unit: data.dosage_unit,
        form: data.form,
        quantity: data.quantity,
        refills_authorized: data.refills_authorized,
        sig: data.sig,
        instructions: data.instructions,
        pharmacy_id: data.pharmacy_id || null,
        is_controlled_substance: data.is_controlled_substance,
        dea_schedule: data.dea_schedule,
        dispense_as_written: data.dispense_as_written,
        diagnosis_code: data.diagnosis_code,
        diagnosis_description: data.diagnosis_description,
      },
    });
    onOpenChange(false);
  };

  const patientName = prescription.patient_profile
    ? `${prescription.patient_profile.first_name || ''} ${prescription.patient_profile.last_name || ''}`.trim() || 'Patient'
    : 'Patient';

  const canEdit = ['draft', 'pending'].includes(prescription.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit Prescription
          </DialogTitle>
          <DialogDescription>
            Update prescription for {patientName} (Rx #{prescription.prescription_number})
          </DialogDescription>
        </DialogHeader>

        {!canEdit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This prescription cannot be edited because it has already been {prescription.status}.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Medication Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Medication Details
              </h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="medication_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Lisinopril" {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="generic_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Generic Name</FormLabel>
                      <FormControl>
                        <Input placeholder="If different from brand" {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="dosage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dosage *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 10" {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dosage_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOSAGE_UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
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
                  name="form"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FORMS.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="refills_authorized"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refills Authorized</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={12} {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Directions */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Directions
              </h3>

              <FormField
                control={form.control}
                name="sig"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sig (Directions) *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Take 1 tablet by mouth once daily"
                        {...field}
                        disabled={!canEdit}
                      />
                    </FormControl>
                    <FormDescription>
                      Standard prescription directions for the patient
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional notes for the pharmacist or patient"
                        {...field}
                        disabled={!canEdit}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pharmacy Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pharmacy
              </h3>

              <FormField
                control={form.control}
                name="pharmacy_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send to Pharmacy</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pharmacy (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pharmacies?.map((pharmacy) => (
                          <SelectItem key={pharmacy.id} value={pharmacy.id}>
                            {pharmacy.name} - {pharmacy.city}, {pharmacy.state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Controlled Substance */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Controlled Substance
              </h3>

              <FormField
                control={form.control}
                name="is_controlled_substance"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Controlled Substance</FormLabel>
                      <FormDescription>
                        Is this medication a controlled substance?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!canEdit}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isControlled && (
                <>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Controlled substance prescriptions require additional verification and DEA compliance.
                    </AlertDescription>
                  </Alert>

                  <FormField
                    control={form.control}
                    name="dea_schedule"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DEA Schedule *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DEA_SCHEDULES.map((schedule) => (
                              <SelectItem key={schedule} value={schedule}>
                                Schedule {schedule}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="dispense_as_written"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Dispense as Written (DAW)</FormLabel>
                      <FormDescription>
                        Prevent generic substitution
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!canEdit}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Diagnosis */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Diagnosis (Optional)
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="diagnosis_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICD-10 Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., I10" {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="diagnosis_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Diagnosis</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Essential hypertension" {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePrescription.isPending || !canEdit}>
                {updatePrescription.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
