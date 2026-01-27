import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pill, Clock, MoreVertical, Edit, Trash2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MedicationCardProps {
  medication: {
    id: string;
    name: string;
    dosage: string;
    dosage_unit: string;
    form: string;
    instructions?: string;
    is_active: boolean;
    refills_remaining?: number | null;
    schedules?: Array<{
      time_of_day: string;
      quantity: number;
    }>;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRequestRefill?: (id: string) => void;
}

export function MedicationCard({ medication, onEdit, onDelete, onRequestRefill }: MedicationCardProps) {
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
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
              {formIcons[medication.form] || "💊"}
            </div>
            <div>
              <CardTitle className="text-base">{medication.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {medication.dosage} {medication.dosage_unit} • {medication.form}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={medication.is_active ? "default" : "secondary"}>
              {medication.is_active ? "Active" : "Inactive"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background">
                <DropdownMenuItem onClick={() => onEdit?.(medication.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRequestRefill?.(medication.id)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Request Refill
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete?.(medication.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {medication.instructions && (
          <p className="text-sm text-muted-foreground mb-3">{medication.instructions}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {medication.schedules && medication.schedules.length > 0 && (
            <>
              {medication.schedules.map((schedule, idx) => (
                <Badge key={idx} variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {schedule.time_of_day.slice(0, 5)} ({schedule.quantity}x)
                </Badge>
              ))}
            </>
          )}
          {typeof medication.refills_remaining === "number" && (
            <Badge 
              variant="outline" 
              className={medication.refills_remaining === 0 ? "border-destructive text-destructive" : ""}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {medication.refills_remaining} refill{medication.refills_remaining !== 1 ? "s" : ""} left
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
