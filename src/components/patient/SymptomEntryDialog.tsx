// Force module refresh - v2
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOfflineSymptomLog } from "@/hooks/useOfflineSymptomLog";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CloudOff } from "lucide-react";

interface SymptomEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SYMPTOM_TYPES = [
  "Headache",
  "Nausea",
  "Fatigue",
  "Dizziness",
  "Pain",
  "Stomach upset",
  "Insomnia",
  "Anxiety",
  "Mood changes",
  "Skin reaction",
  "Breathing difficulty",
  "Other",
];

interface Medication {
  id: string;
  name: string;
}

export function SymptomEntryDialog({ open, onOpenChange, onSuccess }: SymptomEntryDialogProps) {
  const { user } = useAuth();
  const { logSymptom, isOnline } = useOfflineSymptomLog();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [symptomType, setSymptomType] = useState("");
  const [severity, setSeverity] = useState([5]);
  const [description, setDescription] = useState("");
  const [medicationId, setMedicationId] = useState<string>("");
  const [medications, setMedications] = useState<Medication[]>([]);

  useEffect(() => {
    if (open && user) {
      fetchMedications();
    }
  }, [open, user]);

  const fetchMedications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("medications")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_active", true);
    
    setMedications(data || []);
  };

  const resetForm = () => {
    setSymptomType("");
    setSeverity([5]);
    setDescription("");
    setMedicationId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !symptomType) return;

    setLoading(true);
    try {
      const success = await logSymptom({
        userId: user.id,
        symptomType,
        severity: severity[0],
        description: description || null,
        medicationId: medicationId || null,
      });

      if (success) {
        if (isOnline) {
          toast.success("Symptom logged successfully!");
        }
        resetForm();
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error logging symptom:", error);
      toast.error("Failed to log symptom");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityLabel = (value: number) => {
    if (value <= 2) return "Mild";
    if (value <= 4) return "Moderate";
    if (value <= 6) return "Significant";
    if (value <= 8) return "Severe";
    return "Very Severe";
  };

  const getSeverityColor = (value: number) => {
    if (value <= 2) return "text-green-500";
    if (value <= 4) return "text-yellow-500";
    if (value <= 6) return "text-orange-500";
    if (value <= 8) return "text-red-500";
    return "text-red-700";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Log Symptom
            {!isOnline && (
              <CloudOff className="h-4 w-4 text-muted-foreground" />
            )}
          </DialogTitle>
          <DialogDescription>
            Record how you're feeling to track patterns over time
            {!isOnline && (
              <span className="block text-xs text-amber-600 mt-1">
                {t.offline.pendingSync}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="symptomType">Symptom Type *</Label>
            <Select value={symptomType} onValueChange={setSymptomType}>
              <SelectTrigger>
                <SelectValue placeholder="Select symptom" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {SYMPTOM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Severity</Label>
              <span className={`font-medium ${getSeverityColor(severity[0])}`}>
                {severity[0]}/10 - {getSeverityLabel(severity[0])}
              </span>
            </div>
            <Slider
              value={severity}
              onValueChange={setSeverity}
              min={1}
              max={10}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mild</span>
              <span>Moderate</span>
              <span>Severe</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="medication">Related Medication (optional)</Label>
            <Select value={medicationId} onValueChange={setMedicationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select if related to a medication" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="">None</SelectItem>
                {medications.map((med) => (
                  <SelectItem key={med.id} value={med.id}>
                    {med.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe what you're experiencing..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !symptomType}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Log Symptom"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
