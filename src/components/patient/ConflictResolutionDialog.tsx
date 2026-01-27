import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Clock, 
  Cloud, 
  Smartphone, 
  Loader2, 
  Merge, 
  ArrowRight,
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";
import { ConflictEntry, conflictManager, FieldMergeDecision, MergeResult } from "@/lib/conflictResolution";
import { cn } from "@/lib/utils";

interface ConflictResolutionDialogProps {
  conflict: ConflictEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (conflictId: string, resolution: "keep_local" | "keep_server" | "merge", mergedData?: Record<string, unknown>) => void;
}

export function ConflictResolutionDialog({
  conflict,
  open,
  onOpenChange,
  onResolved,
}: ConflictResolutionDialogProps) {
  const [resolution, setResolution] = useState<"keep_local" | "keep_server" | "merge">("keep_local");
  const [isResolving, setIsResolving] = useState(false);

  // Get merge preview
  const mergePreview = useMemo<MergeResult | null>(() => {
    if (!conflict) return null;
    return conflictManager.getMergePreview(conflict);
  }, [conflict]);

  const canMerge = conflict ? conflictManager.canMerge(conflict) : false;

  if (!conflict) return null;

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await conflictManager.resolveConflict(conflict.id, resolution);
      
      // Pass merged data if merge resolution was chosen
      const mergedData = resolution === "merge" && mergePreview 
        ? mergePreview.mergedData 
        : undefined;
      
      onResolved(conflict.id, resolution, mergedData);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
    } finally {
      setIsResolving(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const getRelevantFields = (data: Record<string, unknown>): [string, unknown][] => {
    const excludeFields = ["id", "user_id", "created_at", "updated_at", "_pending", "_localId"];
    return Object.entries(data).filter(([key]) => !excludeFields.includes(key));
  };

  const localFields = getRelevantFields(conflict.localData);
  const serverFields = conflict.serverData ? getRelevantFields(conflict.serverData) : [];

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      status: "Status",
      taken_at: "Taken At",
      scheduled_time: "Scheduled Time",
      medication_id: "Medication",
      symptom_type: "Symptom Type",
      severity: "Severity",
      description: "Description",
      recorded_at: "Recorded At",
      notes: "Notes",
      schedule_id: "Schedule",
    };
    return labels[field] || field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getSourceIcon = (source: FieldMergeDecision["source"]) => {
    switch (source) {
      case "local":
        return <Smartphone className="h-3 w-3 text-blue-500" />;
      case "server":
        return <Cloud className="h-3 w-3 text-green-500" />;
      case "merged":
        return <Merge className="h-3 w-3 text-purple-500" />;
    }
  };

  const getSourceLabel = (source: FieldMergeDecision["source"]) => {
    switch (source) {
      case "local":
        return "Local";
      case "server":
        return "Server";
      case "merged":
        return "Combined";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription>
            {conflictManager.getConflictDescription(conflict)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Conflict type badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {conflictManager.getTypeLabel(conflict.type)}
              </Badge>
              <Badge 
                variant={conflict.conflictType === "delete_conflict" ? "destructive" : "secondary"}
              >
                {conflict.conflictType === "update_conflict" && "Update Conflict"}
                {conflict.conflictType === "delete_conflict" && "Deleted on Server"}
                {conflict.conflictType === "stale_data" && "Stale Data"}
              </Badge>
              {canMerge && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  <Merge className="h-3 w-3 mr-1" />
                  Merge Available
                </Badge>
              )}
            </div>

            {/* Comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local version */}
              <Card className={cn(
                "border-2 transition-colors",
                resolution === "keep_local" ? "border-primary bg-primary/5" : "border-muted"
              )}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Your Offline Version
                  </CardTitle>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(conflict.localTimestamp, "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {localFields.map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-muted-foreground">{getFieldLabel(key)}:</span>{" "}
                      <span className="font-medium">{formatValue(value)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Server version */}
              <Card className={cn(
                "border-2 transition-colors",
                resolution === "keep_server" ? "border-primary bg-primary/5" : "border-muted",
                conflict.conflictType === "delete_conflict" && "opacity-60"
              )}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Server Version
                  </CardTitle>
                  {conflict.serverTimestamp && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(conflict.serverTimestamp), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {conflict.conflictType === "delete_conflict" ? (
                    <p className="text-sm text-muted-foreground italic">
                      This entry has been deleted from the server
                    </p>
                  ) : serverFields.length > 0 ? (
                    serverFields.map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="text-muted-foreground">{getFieldLabel(key)}:</span>{" "}
                        <span className="font-medium">{formatValue(value)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No server data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Merge Preview */}
            {resolution === "merge" && mergePreview && (
              <Card className="border-2 border-purple-300 bg-purple-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Merge className="h-4 w-4 text-purple-600" />
                    Intelligent Merge Preview
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Fields are merged based on type and timestamp priority
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mergePreview.fieldDecisions
                      .filter(d => !["id", "user_id", "created_at", "updated_at", "_pending", "_localId"].includes(d.field))
                      .map((decision) => {
                        const hasConflict = JSON.stringify(decision.localValue) !== JSON.stringify(decision.serverValue);
                        
                        return (
                          <div 
                            key={decision.field} 
                            className={cn(
                              "p-2 rounded-md text-sm",
                              hasConflict ? "bg-white border" : "bg-purple-50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{getFieldLabel(decision.field)}</span>
                              <div className="flex items-center gap-1 text-xs">
                                {getSourceIcon(decision.source)}
                                <span className="text-muted-foreground">
                                  {getSourceLabel(decision.source)}
                                </span>
                              </div>
                            </div>
                            
                            {hasConflict ? (
                              <div className="flex items-center gap-2 text-xs">
                                <div className="flex-1">
                                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                    <Smartphone className="h-3 w-3" />
                                    <span>Local:</span>
                                  </div>
                                  <span className={decision.source === "local" ? "text-blue-600 font-medium" : "line-through opacity-50"}>
                                    {formatValue(decision.localValue)}
                                  </span>
                                </div>
                                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                                    <Cloud className="h-3 w-3" />
                                    <span>Server:</span>
                                  </div>
                                  <span className={decision.source === "server" ? "text-green-600 font-medium" : "line-through opacity-50"}>
                                    {formatValue(decision.serverValue)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {decision.source === "local" ? (
                                    <Check className="h-4 w-4 text-blue-500" />
                                  ) : decision.source === "server" ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Merge className="h-4 w-4 text-purple-500" />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground">
                                {formatValue(decision.mergedValue)}
                                <span className="text-xs ml-2">(no conflict)</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Resolution options */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Choose how to resolve:</Label>
              <RadioGroup
                value={resolution}
                onValueChange={(value) => setResolution(value as "keep_local" | "keep_server" | "merge")}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="keep_local" id="keep_local" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="keep_local" className="font-medium cursor-pointer flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Keep my offline version
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Overwrite the server with your local changes
                    </p>
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                  conflict.conflictType === "delete_conflict" && "opacity-50"
                )}>
                  <RadioGroupItem 
                    value="keep_server" 
                    id="keep_server" 
                    className="mt-1"
                    disabled={conflict.conflictType === "delete_conflict"}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="keep_server" 
                      className={cn(
                        "font-medium cursor-pointer flex items-center gap-2",
                        conflict.conflictType === "delete_conflict" && "cursor-not-allowed"
                      )}
                    >
                      <Cloud className="h-4 w-4" />
                      Keep server version
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {conflict.conflictType === "delete_conflict" 
                        ? "Cannot keep deleted data"
                        : "Discard your local changes and use the server data"
                      }
                    </p>
                  </div>
                </div>

                {/* Merge option */}
                <div className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border transition-colors",
                  canMerge ? "hover:bg-purple-50 border-purple-200" : "opacity-50",
                  resolution === "merge" && "bg-purple-50 border-purple-300"
                )}>
                  <RadioGroupItem 
                    value="merge" 
                    id="merge" 
                    className="mt-1"
                    disabled={!canMerge}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor="merge" 
                      className={cn(
                        "font-medium cursor-pointer flex items-center gap-2",
                        !canMerge && "cursor-not-allowed"
                      )}
                    >
                      <Merge className="h-4 w-4 text-purple-600" />
                      Intelligent merge
                      <Badge variant="secondary" className="text-xs">Recommended</Badge>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {canMerge 
                        ? "Combine both versions intelligently based on field type and timestamp"
                        : "Merge is not available for deleted entries"
                      }
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Decide Later
          </Button>
          <Button 
            onClick={handleResolve} 
            disabled={isResolving}
            className={cn(
              resolution === "merge" && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            {isResolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {resolution === "keep_local" && "Use My Version"}
            {resolution === "keep_server" && "Use Server Version"}
            {resolution === "merge" && (
              <>
                <Merge className="h-4 w-4 mr-2" />
                Apply Merge
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
