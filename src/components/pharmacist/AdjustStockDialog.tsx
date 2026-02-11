import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  adjustment_type: z.enum(["received", "return", "destroyed", "loss", "correction"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  invoice_number: z.string().max(100).optional(),
  supplier: z.string().max(200).optional(),
  reason: z.string().min(1, "Reason is required").max(500),
});

type FormValues = z.infer<typeof formSchema>;

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drug: ControlledDrug;
  onSuccess: () => void;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  drug,
  onSuccess,
}: AdjustStockDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      adjustment_type: "received",
      quantity: 1,
      invoice_number: "",
      supplier: "",
      reason: "",
    },
  });

  const watchedType = form.watch("adjustment_type");
  const watchedQuantity = form.watch("quantity") || 0;

  const isAddition = watchedType === "received" || watchedType === "return";
  const newStock = isAddition 
    ? drug.current_stock + watchedQuantity
    : drug.current_stock - watchedQuantity;

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    if (!isAddition && values.quantity > drug.current_stock) {
      toast.error("Cannot remove more than current stock");
      return;
    }

    setIsSubmitting(true);
    try {
      const adjustedQuantity = isAddition ? values.quantity : -values.quantity;
      
      const { error } = await supabase.from("controlled_drug_adjustments").insert({
        controlled_drug_id: drug.id,
        adjustment_type: values.adjustment_type,
        quantity: adjustedQuantity,
        previous_stock: drug.current_stock,
        new_stock: newStock,
        invoice_number: values.invoice_number || null,
        supplier: values.supplier || null,
        reason: values.reason,
        performed_by: user.id,
      });

      if (error) throw error;

      toast.success(`Stock adjusted: ${drug.name} now has ${newStock} ${drug.unit_of_measure}`);
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(error.message || "Failed to adjust stock");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Record a stock adjustment for {drug.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
          <div>
            <p className="font-medium">{drug.name}</p>
            <p className="text-sm text-muted-foreground">{drug.strength} {drug.form}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Stock</p>
            <p className="font-bold">{drug.current_stock} {drug.unit_of_measure}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="adjustment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adjustment Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="received">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Received (New Stock)
                        </span>
                      </SelectItem>
                      <SelectItem value="return">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          Return (Add Back)
                        </span>
                      </SelectItem>
                      <SelectItem value="destroyed">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          Destroyed
                        </span>
                      </SelectItem>
                      <SelectItem value="loss">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-orange-600" />
                          Loss/Theft
                        </span>
                      </SelectItem>
                      <SelectItem value="correction">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-gray-600" />
                          Correction (Remove)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max={isAddition ? undefined : drug.current_stock}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">New stock level:</span>
              <span className={`font-bold flex items-center gap-1 ${
                newStock < 0 ? "text-destructive" : isAddition ? "text-green-600" : ""
              }`}>
                {isAddition ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {newStock} {drug.unit_of_measure}
              </span>
            </div>

            {(watchedType === "received") && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="INV-123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier</FormLabel>
                      <FormControl>
                        <Input placeholder="Supplier name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the reason for this adjustment..." 
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
                disabled={isSubmitting || newStock < 0}
              >
                {isSubmitting ? "Saving..." : "Record Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
