import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Camera, Upload, Check, X, AlertCircle } from "lucide-react";

interface ExtractedMedication {
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  instructions: string;
  confidence: number;
}

interface PhotoMedicationImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PhotoMedicationImport({ open, onOpenChange, onSuccess }: PhotoMedicationImportProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedMedication[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageData(base64);
      setExtracted([]);
      setSelectedMeds(new Set());
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const analyzeImage = async () => {
    if (!imageData) return;
    setAnalyzing(true);
    setError(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke("extract-medication-ocr", {
        body: { image: imageData },
      });

      if (funcError) throw funcError;

      if (data?.medications && data.medications.length > 0) {
        setExtracted(data.medications);
        setSelectedMeds(new Set(data.medications.map((_: any, i: number) => i)));
      } else {
        setError("No medications found in the image. Please try a clearer photo of the prescription label.");
      }
    } catch (err) {
      console.error("Error analyzing image:", err);
      setError("Failed to analyze image. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleMedication = (index: number) => {
    const newSelected = new Set(selectedMeds);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedMeds(newSelected);
  };

  const saveMedications = async () => {
    if (!user || selectedMeds.size === 0) return;
    setSaving(true);

    try {
      const medsToSave = Array.from(selectedMeds).map((i) => {
        const med = extracted[i];
        return {
          user_id: user.id,
          name: med.name,
          dosage: med.dosage,
          dosage_unit: med.dosage_unit || "mg",
          form: med.form || "tablet",
          instructions: med.instructions || null,
        };
      });

      const { error } = await supabase.from("medications").insert(medsToSave);
      if (error) throw error;

      toast.success(`${medsToSave.length} medication(s) imported successfully!`);
      resetState();
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Error saving medications:", err);
      toast.error("Failed to save medications");
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setImageData(null);
    setExtracted([]);
    setSelectedMeds(new Set());
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[600px] bg-background max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Medication from Photo</DialogTitle>
          <DialogDescription>
            Take a photo of your prescription label or medication box to automatically extract details
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!imageData ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Take a photo of your prescription label or upload an image
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCapture}>
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
                <Button variant="outline" onClick={handleCapture}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              For best results, ensure the text is clear and well-lit
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={imageData}
                alt="Prescription"
                className="w-full max-h-48 object-contain rounded-lg border"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={resetState}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!extracted.length && !analyzing && !error && (
              <Button onClick={analyzeImage} className="w-full">
                Analyze Prescription
              </Button>
            )}

            {analyzing && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Analyzing image...</span>
              </div>
            )}

            {error && (
              <Card className="border-destructive">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm">{error}</p>
                </CardContent>
              </Card>
            )}

            {extracted.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Found {extracted.length} medication(s):</p>
                {extracted.map((med, i) => (
                  <Card
                    key={i}
                    className={`cursor-pointer transition-colors ${
                      selectedMeds.has(i) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleMedication(i)}
                  >
                    <CardContent className="py-3 flex items-center gap-3">
                      <div className={`h-5 w-5 rounded border flex items-center justify-center ${
                        selectedMeds.has(i) ? "bg-primary border-primary" : "border-muted-foreground"
                      }`}>
                        {selectedMeds.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {med.dosage} {med.dosage_unit} • {med.form}
                        </p>
                        {med.instructions && (
                          <p className="text-xs text-muted-foreground mt-1">{med.instructions}</p>
                        )}
                      </div>
                      {med.confidence < 0.7 && (
                        <span className="text-xs text-warning">Low confidence</span>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={resetState}>
                    Try Another
                  </Button>
                  <Button onClick={saveMedications} disabled={saving || selectedMeds.size === 0}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {selectedMeds.size} Medication(s)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
