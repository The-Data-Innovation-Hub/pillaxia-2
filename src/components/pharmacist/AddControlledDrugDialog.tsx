import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Drug name is required").max(200),
  generic_name: z.string().max(200).optional(),
  schedule: z.enum(["II", "III", "IV", "V"]),
  form: z.string().min(1, "Form is required"),
  strength: z.string().min(1, "Strength is required"),
  manufacturer: z.string().max(200).optional(),
  ndc_number: z.string().max(50).optional(),
  lot_number: z.string().max(50).optional(),
  expiry_date: z.date().optional(),
  current_stock: z.coerce.number().min(0, "Stock cannot be negative"),
  minimum_stock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
  unit_of_measure: z.string().min(1, "Unit is required"),
  storage_location: z.string().max(100).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddControlledDrugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddControlledDrugDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddControlledDrugDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      generic_name: "",
      schedule: "II",
      form: "tablet",
      strength: "",
      manufacturer: "",
      ndc_number: "",
      lot_number: "",
      expiry_date: undefined,
      current_stock: 0,
      minimum_stock: 10,
      unit_of_measure: "units",
      storage_location: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("controlled_drugs").insert({
        name: values.name,
        generic_name: values.generic_name || null,
        schedule: values.schedule,
        form: values.form,
        strength: values.strength,
        manufacturer: values.manufacturer || null,
        ndc_number: values.ndc_number || null,
        lot_number: values.lot_number || null,
        expiry_date: values.expiry_date ? format(values.expiry_date, "yyyy-MM-dd") : null,
        current_stock: values.current_stock,
        minimum_stock: values.minimum_stock,
        unit_of_measure: values.unit_of_measure,
        storage_location: values.storage_location || null,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Controlled drug added to register");
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Failed to add controlled drug");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Controlled Drug</DialogTitle>
          <DialogDescription>
            Add a new controlled substance to the DEA register inventory.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Drug Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Oxycodone HCl" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="generic_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Generic Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Oxycodone Hydrochloride" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DEA Schedule *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="II">Schedule II</SelectItem>
                        <SelectItem value="III">Schedule III</SelectItem>
                        <SelectItem value="IV">Schedule IV</SelectItem>
                        <SelectItem value="V">Schedule V</SelectItem>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="capsule">Capsule</SelectItem>
                        <SelectItem value="liquid">Liquid</SelectItem>
                        <SelectItem value="injection">Injection</SelectItem>
                        <SelectItem value="patch">Patch</SelectItem>
                        <SelectItem value="powder">Powder</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="strength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strength *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 10mg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ndc_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NDC Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 12345-6789-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lot_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lot Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., LOT-2025-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiry Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick expiry date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Mallinckrodt Pharmaceuticals" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Stock *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimum_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Stock *</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_of_measure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="units">Units</SelectItem>
                        <SelectItem value="tablets">Tablets</SelectItem>
                        <SelectItem value="capsules">Capsules</SelectItem>
                        <SelectItem value="ml">mL</SelectItem>
                        <SelectItem value="patches">Patches</SelectItem>
                        <SelectItem value="grams">Grams</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="storage_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Safe A, Shelf 2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add to Register"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
