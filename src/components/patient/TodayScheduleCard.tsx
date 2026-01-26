import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TodayScheduleCardProps {
  log: {
    id: string;
    scheduled_time: string;
    status: string;
    taken_at?: string;
    medication: {
      name: string;
      dosage: string;
      dosage_unit: string;
      form: string;
    };
    schedule: {
      quantity: number;
      with_food: boolean;
    };
  };
  onTake: (id: string) => void;
  onSkip: (id: string) => void;
}

export function TodayScheduleCard({ log, onTake, onSkip }: TodayScheduleCardProps) {
  const scheduledTime = new Date(log.scheduled_time);
  const now = new Date();
  const isPast = scheduledTime < now;
  const isUpcoming = !isPast && scheduledTime.getTime() - now.getTime() < 30 * 60 * 1000; // Within 30 min

  const statusColors = {
    pending: isPast ? "bg-amber-500" : isUpcoming ? "bg-blue-500" : "bg-muted",
    taken: "bg-green-500",
    skipped: "bg-gray-400",
    missed: "bg-red-500",
  };

  const formIcons: Record<string, string> = {
    tablet: "💊",
    capsule: "💊",
    liquid: "🧴",
    injection: "💉",
    inhaler: "🌬️",
    cream: "🧴",
    drops: "💧",
  };

  return (
    <Card className={cn(
      "transition-all",
      log.status === "pending" && isUpcoming && "ring-2 ring-primary shadow-md",
      log.status === "taken" && "opacity-75",
      log.status === "skipped" && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Time indicator */}
          <div className="flex flex-col items-center">
            <div className={cn(
              "h-3 w-3 rounded-full mb-1",
              statusColors[log.status as keyof typeof statusColors]
            )} />
            <span className="text-sm font-medium">
              {format(scheduledTime, "HH:mm")}
            </span>
          </div>

          {/* Medication info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{formIcons[log.medication.form] || "💊"}</span>
              <div>
                <p className="font-medium">{log.medication.name}</p>
                <p className="text-sm text-muted-foreground">
                  {log.schedule.quantity}x {log.medication.dosage} {log.medication.dosage_unit}
                  {log.schedule.with_food && " • Take with food"}
                </p>
              </div>
            </div>
          </div>

          {/* Status/Actions */}
          <div className="flex items-center gap-2">
            {log.status === "pending" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => onSkip(log.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => onTake(log.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Take
                </Button>
              </>
            ) : (
              <Badge
                variant={log.status === "taken" ? "default" : "secondary"}
                className={cn(
                  log.status === "taken" && "bg-green-600",
                  log.status === "skipped" && "bg-gray-400",
                  log.status === "missed" && "bg-red-500"
                )}
              >
                {log.status === "taken" && (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Taken {log.taken_at && format(new Date(log.taken_at), "HH:mm")}
                  </>
                )}
                {log.status === "skipped" && "Skipped"}
                {log.status === "missed" && "Missed"}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
