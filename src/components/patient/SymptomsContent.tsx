// Content extracted from SymptomsPage for use in tabbed interface
import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, CloudOff, RefreshCw, Clock, TrendingUp, Activity, List, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { SymptomEntryDialog } from "./SymptomEntryDialog";
import { SymptomTrendsChart } from "./SymptomTrendsChart";
import { SymptomCorrelations } from "./SymptomCorrelations";
import { SymptomTimeAnalysis } from "./SymptomTimeAnalysis";
import { SymptomCalendar } from "./SymptomCalendar";
import { OfflineSyncIndicator } from "./OfflineSyncIndicator";
import {
  SymptomFiltersPanel,
  applySymptomFilters,
  DEFAULT_FILTERS,
  type SymptomFilters,
} from "./SymptomFilters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCachedSymptoms } from "@/hooks/useCachedSymptoms";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export function SymptomsContent() {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const { symptoms, loading, isFromCache, refresh, hasPending } = useCachedSymptoms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<SymptomFilters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<string>("entries");

  // Apply filters to symptoms
  const filteredSymptoms = useMemo(
    () => applySymptomFilters(symptoms, filters),
    [symptoms, filters]
  );

  const handleDelete = async (id: string) => {
    if (id.startsWith("pending-")) {
      toast.error("Cannot delete entries that haven't synced yet");
      return;
    }

    try {
      const { error } = await supabase
        .from("symptom_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Entry deleted");
      refresh();
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
          <div className="flex items-center gap-2">
            {isFromCache && !isOnline && (
              <CloudOff className="h-5 w-5 text-warning" />
            )}
          </div>
          {hasPending && (
            <p className="text-sm text-warning">{symptoms.filter(s => s._pending).length} pending sync</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <OfflineSyncIndicator onSyncComplete={refresh} />
          {isFromCache && !isOnline && (
            <Button variant="outline" size="icon" onClick={refresh} disabled={!isOnline}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Symptom
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {symptoms.length > 0 && (
        <SymptomFiltersPanel
          symptoms={symptoms}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}

      {/* Main Content with Tabs */}
      {filteredSymptoms.length === 0 && symptoms.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium mb-2">No symptoms match filters</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filter criteria
            </p>
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : symptoms.length === 0 ? (
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="entries" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Entries</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trends</span>
            </TabsTrigger>
            <TabsTrigger value="correlations" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Correlations</span>
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Time</span>
            </TabsTrigger>
          </TabsList>

          {/* Entries Tab */}
          <TabsContent value="entries" className="mt-0 space-y-3">
            <h2 className="text-lg font-semibold">
              {filters.dateFrom || filters.dateTo || filters.symptomType || filters.medicationId || filters.severityRange[0] !== 1 || filters.severityRange[1] !== 10
                ? `Filtered Entries (${filteredSymptoms.length})`
                : `Recent Entries (${filteredSymptoms.length})`}
            </h2>
            {filteredSymptoms.map((symptom) => (
              <Card 
                key={symptom.id} 
                className={cn(
                  "hover:shadow-md transition-shadow",
                  symptom._pending && "border-dashed border-warning/50 bg-warning/5"
                )}
              >
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
                          {symptom._pending && (
                            <Badge variant="outline" className="text-xs border-warning text-warning gap-1">
                              <Clock className="h-3 w-3" />
                              Pending sync
                            </Badge>
                          )}
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
                      disabled={symptom._pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-0">
            <SymptomCalendar symptoms={filteredSymptoms} />
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="mt-0">
            <SymptomTrendsChart symptoms={filteredSymptoms} />
          </TabsContent>

          {/* Correlations Tab */}
          <TabsContent value="correlations" className="mt-0">
            {filteredSymptoms.length >= 3 ? (
              <SymptomCorrelations symptoms={filteredSymptoms} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="text-lg font-medium mb-2">Not enough data</h3>
                  <p className="text-muted-foreground">
                    Log at least 3 symptoms to see correlation insights
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Time Analysis Tab */}
          <TabsContent value="time" className="mt-0">
            {filteredSymptoms.length >= 3 ? (
              <SymptomTimeAnalysis symptoms={filteredSymptoms} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-4xl mb-4">⏰</div>
                  <h3 className="text-lg font-medium mb-2">Not enough data</h3>
                  <p className="text-muted-foreground">
                    Log at least 3 symptoms to see time-of-day analysis
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <SymptomEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={refresh}
      />
    </div>
  );
}
