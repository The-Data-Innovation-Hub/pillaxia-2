import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { useDrugInteractions } from "@/hooks/useDrugInteractions";
import { DrugInteractionWarning } from "./DrugInteractionWarning";

interface AddMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingMedications?: string[];
}

interface Schedule {
  time: string;
  quantity: number;
}

const MEDICATION_FORMS = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "liquid", label: "Liquid" },
  { value: "injection", label: "Injection" },
  { value: "inhaler", label: "Inhaler" },
  { value: "cream", label: "Cream/Ointment" },
  { value: "drops", label: "Drops" },
];

const DOSAGE_UNITS = ["mg", "g", "ml", "mcg", "IU", "units"];

export function AddMedicationDialog({ open, onOpenChange, onSuccess, existingMedications = [] }: AddMedicationDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageUnit, setDosageUnit] = useState("mg");
  const [form, setForm] = useState("tablet");
  const [instructions, setInstructions] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([{ time: "08:00", quantity: 1 }]);
  const { interactions, checkInteractions, clearInteractions } = useDrugInteractions();

  // Check for drug interactions when medication name changes
  useEffect(() => {
    if (name.length >= 3 && existingMedications.length > 0) {
      const timeoutId = setTimeout(() => {
        checkInteractions(name, existingMedications);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      clearInteractions();
    }
  }, [name, existingMedications, checkInteractions, clearInteractions]);

  const addSchedule = () => {
    setSchedules([...schedules, { time: "12:00", quantity: 1 }]);
  };

  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const updateSchedule = (index: number, field: keyof Schedule, value: string | number) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const resetForm = () => {
    setName("");
    setDosage("");
    setDosageUnit("mg");
    setForm("tablet");
    setInstructions("");
    setSchedules([{ time: "08:00", quantity: 1 }]);
    clearInteractions();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      // Insert medication
      const { data: medication, error: medError } = await db
        .from("medications")
        .insert({
          user_id: user.id,
          name,
          dosage,
          dosage_unit: dosageUnit,
          form,
          instructions: instructions || null,
        })
        .select()
        .single();

      if (medError) throw medError;

      // Insert schedules
      if (schedules.length > 0) {
        const schedulesData = schedules.map((s) => ({
          medication_id: medication.id,
          time_of_day: s.time,
          quantity: s.quantity,
        }));

        const { error: schedError } = await db
          .from("medication_schedules")
          .insert(schedulesData);

        if (schedError) throw schedError;
      }

      toast.success("Medication added successfully!");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding medication:", error);
      toast.error("Failed to add medication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Medication</DialogTitle>
          <DialogDescription>
            Add a new medication to your tracker
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Medication Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Metformin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {interactions.length > 0 && (
            <DrugInteractionWarning interactions={interactions} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage *</Label>
              <Input
                id="dosage"
                placeholder="e.g., 500"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dosageUnit">Unit</Label>
              <Select value={dosageUnit} onValueChange={setDosageUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {DOSAGE_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="form">Form</Label>
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {MEDICATION_FORMS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions (optional)</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., Take with food"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Schedule</Label>
              <Button type="button" variant="outline" size="sm" onClick={addSchedule}>
                <Plus className="h-4 w-4 mr-1" />
                Add Time
              </Button>
            </div>
            {schedules.map((schedule, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => updateSchedule(index, "time", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={schedule.quantity}
                  onChange={(e) => updateSchedule(index, "quantity", parseFloat(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">qty</span>
                {schedules.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSchedule(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name || !dosage}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Medication"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
