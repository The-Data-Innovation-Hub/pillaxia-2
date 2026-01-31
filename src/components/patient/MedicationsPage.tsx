import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, CloudOff, RefreshCw, Camera } from "lucide-react";
import { MedicationCard } from "./MedicationCard";
import { AddMedicationDialog } from "./AddMedicationDialog";
import { PhotoMedicationImport } from "./PhotoMedicationImport";
import { RequestRefillDialog } from "./RequestRefillDialog";
import { RefillRequestsCard } from "./RefillRequestsCard";
import { toast } from "sonner";
import { useCachedMedications } from "@/hooks/useCachedMedications";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MedicationForRefill {
  id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  pharmacy: string | null;
  refills_remaining: number | null;
}

export function MedicationsPage() {
  const { medications, loading, isFromCache, refetch } = useCachedMedications();
  const { isOffline } = useOfflineStatus();
  const { t } = useLanguage();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [photoImportOpen, setPhotoImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [refillMedication, setRefillMedication] = useState<MedicationForRefill | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("medications")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast.success(t.medications.deletedSuccess);
      refetch();
    } catch (error) {
      console.error("Error deleting medication:", error);
      toast.error(t.medications.deleteFailed);
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.medications.title}</h1>
          <p className="text-muted-foreground">
            {t.medications.subtitle}
          </p>
          {isFromCache && (
            <div className="flex items-center gap-1.5 text-xs text-warning mt-1">
              <CloudOff className="h-3 w-3" />
              <span>{t.offline.showingCachedData}</span>
              {!isOffline && (
                <button 
                  onClick={refetch}
                  className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  {t.common.refresh}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPhotoImportOpen(true)} disabled={isOffline}>
            <Camera className="h-4 w-4 mr-2" />
            {t.medications.scanRx}
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} disabled={isOffline}>
            <Plus className="h-4 w-4 mr-2" />
            {t.medications.addMedication}
          </Button>
        </div>
      </div>

      {/* Refill Requests Summary */}
      <RefillRequestsCard />

      {medications.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <div className="text-4xl mb-4">💊</div>
          <h3 className="text-lg font-medium mb-2">{t.medications.noMedications}</h3>
          <p className="text-muted-foreground mb-4">
            {t.medications.addFirst}
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t.medications.addMedication}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {medications.map((med) => (
            <MedicationCard
              key={med.id}
              medication={{
                ...med,
                instructions: med.instructions || undefined,
                schedules: med.medication_schedules,
              }}
              onEdit={(id) => toast.info(t.common.comingSoon)}
              onDelete={(id) => setDeleteId(id)}
              onRequestRefill={(id) => {
                const medication = medications.find((m) => m.id === id);
                if (medication) {
                  setRefillMedication({
                    id: medication.id,
                    name: medication.name,
                    dosage: medication.dosage,
                    dosage_unit: medication.dosage_unit,
                    form: medication.form,
                    pharmacy: medication.pharmacy,
                    refills_remaining: medication.refills_remaining,
                  });
                }
              }}
            />
          ))}
        </div>
      )}

      <AddMedicationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={refetch}
        existingMedications={medications.map(m => m.name)}
      />

      <PhotoMedicationImport
        open={photoImportOpen}
        onOpenChange={setPhotoImportOpen}
        onSuccess={refetch}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.medications.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.medications.deleteConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

      <RequestRefillDialog
        open={!!refillMedication}
        onOpenChange={(open) => !open && setRefillMedication(null)}
        medication={refillMedication}
        onSuccess={refetch}
      />
    </div>
  );
}
