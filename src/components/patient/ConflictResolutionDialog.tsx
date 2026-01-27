import { useState } from "react";
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
import { AlertTriangle, Clock, Cloud, Smartphone, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ConflictEntry, conflictManager } from "@/lib/conflictResolution";
import { cn } from "@/lib/utils";

interface ConflictResolutionDialogProps {
  conflict: ConflictEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: (conflictId: string, resolution: "keep_local" | "keep_server" | "merge") => void;
}

export function ConflictResolutionDialog({
  conflict,
  open,
  onOpenChange,
  onResolved,
}: ConflictResolutionDialogProps) {
  const [resolution, setResolution] = useState<"keep_local" | "keep_server">("keep_local");
  const [isResolving, setIsResolving] = useState(false);

  if (!conflict) return null;

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await conflictManager.resolveConflict(conflict.id, resolution);
      onResolved(conflict.id, resolution);
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
    };
    return labels[field] || field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Sync Conflict Detected
          </DialogTitle>
          <DialogDescription>
            {conflictManager.getConflictDescription(conflict)}
          </DialogDescription>
        </DialogHeader>

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

          <Separator />

          {/* Resolution options */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Choose how to resolve:</Label>
            <RadioGroup
              value={resolution}
              onValueChange={(value) => setResolution(value as "keep_local" | "keep_server")}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="keep_local" id="keep_local" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="keep_local" className="font-medium cursor-pointer">
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
                      "font-medium cursor-pointer",
                      conflict.conflictType === "delete_conflict" && "cursor-not-allowed"
                    )}
                  >
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
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Decide Later
          </Button>
          <Button onClick={handleResolve} disabled={isResolving}>
            {isResolving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {resolution === "keep_local" ? "Use My Version" : "Use Server Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
