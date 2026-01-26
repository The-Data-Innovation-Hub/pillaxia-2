import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { SymptomEntryDialog } from "./SymptomEntryDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SymptomEntry {
  id: string;
  symptom_type: string;
  severity: number;
  description: string | null;
  recorded_at: string;
  medications: {
    name: string;
  } | null;
}

export function SymptomsPage() {
  const { user } = useAuth();
  const [symptoms, setSymptoms] = useState<SymptomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSymptoms();
    }
  }, [user]);

  const fetchSymptoms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("symptom_entries")
        .select(`
          *,
          medications (name)
        `)
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSymptoms(data || []);
    } catch (error) {
      console.error("Error fetching symptoms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("symptom_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Entry deleted");
      fetchSymptoms();
    } catch (error) {
      console.error("Error deleting symptom:", error);
      toast.error("Failed to delete");
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity <= 2) return "bg-green-500";
    if (severity <= 4) return "bg-yellow-500";
    if (severity <= 6) return "bg-orange-500";
    if (severity <= 8) return "bg-red-500";
    return "bg-red-700";
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
          <h1 className="text-2xl font-bold">Symptom Diary</h1>
          <p className="text-muted-foreground">
            Track your symptoms to identify patterns and side effects
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log Symptom
        </Button>
      </div>

      {symptoms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">No symptoms logged</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking how you feel to identify patterns
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log First Symptom
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {symptoms.map((symptom) => (
            <Card key={symptom.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {/* Severity indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-white font-bold",
                          getSeverityColor(symptom.severity)
                        )}
                      >
                        {symptom.severity}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        /10
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{symptom.symptom_type}</h3>
                        {symptom.medications && (
                          <Badge variant="outline" className="text-xs">
                            {symptom.medications.name}
                          </Badge>
                        )}
                      </div>
                      {symptom.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {symptom.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(symptom.recorded_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(symptom.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SymptomEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchSymptoms}
      />
    </div>
  );
}
