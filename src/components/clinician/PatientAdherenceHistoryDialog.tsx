import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, CheckCircle, XCircle, Clock, Minus, Pill } from "lucide-react";

interface PatientAdherenceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  status: string;
  taken_at: string | null;
  notes: string | null;
  medication: {
    name: string;
    dosage: string;
    dosage_unit: string;
  } | null;
}

export function PatientAdherenceHistoryDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientAdherenceHistoryDialogProps) {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { data: logs, isLoading } = useQuery({
    queryKey: ["patient-adherence-history", patientId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await db
        .from("medication_logs")
        .select(`
          id,
          medication_id,
          scheduled_time,
          status,
          taken_at,
          notes,
          medications (
            name,
            dosage,
            dosage_unit
          )
        `)
        .eq("user_id", patientId)
        .gte("scheduled_time", startOfDay(startDate).toISOString())
        .lte("scheduled_time", endOfDay(endDate).toISOString())
        .order("scheduled_time", { ascending: false });

      if (error) throw error;

      return (data || []).map((log) => ({
        ...log,
        medication: Array.isArray(log.medications) ? log.medications[0] : log.medications,
      })) as MedicationLog[];
    },
    enabled: open && !!patientId,
  });

  const stats = {
    total: logs?.length || 0,
    taken: logs?.filter((l) => l.status === "taken").length || 0,
    missed: logs?.filter((l) => l.status === "missed").length || 0,
    skipped: logs?.filter((l) => l.status === "skipped").length || 0,
    pending: logs?.filter((l) => l.status === "pending").length || 0,
  };

  const adherenceRate = stats.total > 0 
    ? Math.round((stats.taken / (stats.total - stats.pending)) * 100) || 0
    : 0;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "taken":
        return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", label: "Taken" };
      case "missed":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Missed" };
      case "skipped":
        return { icon: Minus, color: "text-amber-600", bg: "bg-amber-100", label: "Skipped" };
      default:
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Pending" };
    }
  };

  // Group logs by date
  const groupedLogs = logs?.reduce((acc, log) => {
    const date = format(new Date(log.scheduled_time), "yyyy-MM-dd");
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, MedicationLog[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Adherence History: {patientName}
          </DialogTitle>
        </DialogHeader>

        {/* Date Range Selector */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  disabled={(date) => date > new Date() || date > endDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  disabled={(date) => date > new Date() || date < startDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          {/* Quick presets */}
          <div className="flex gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 7));
                setEndDate(new Date());
              }}
            >
              7d
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 14));
                setEndDate(new Date());
              }}
            >
              14d
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 30));
                setEndDate(new Date());
              }}
            >
              30d
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-5 gap-2">
          <div className="p-3 rounded-lg bg-muted text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-center">
            <p className="text-2xl font-bold text-green-700">{stats.taken}</p>
            <p className="text-xs text-green-600">Taken</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 text-center">
            <p className="text-2xl font-bold text-red-700">{stats.missed}</p>
            <p className="text-xs text-red-600">Missed</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.skipped}</p>
            <p className="text-xs text-amber-600">Skipped</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-center">
            <p className="text-2xl font-bold text-primary">{adherenceRate}%</p>
            <p className="text-xs text-primary/80">Adherence</p>
          </div>
        </div>

        {/* Logs List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !logs?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No medication logs found for this period</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedLogs || {}).map(([date, dateLogs]) => (
                <div key={date}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                    {format(new Date(date), "EEEE, MMMM d, yyyy")}
                  </h4>
                  <div className="space-y-2">
                    {dateLogs.map((log) => {
                      const config = getStatusConfig(log.status);
                      const StatusIcon = config.icon;
                      return (
                        <div
                          key={log.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        >
                          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", config.bg)}>
                            <StatusIcon className={cn("h-5 w-5", config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {log.medication?.name || "Unknown Medication"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {log.medication?.dosage} {log.medication?.dosage_unit} • 
                              Scheduled: {format(new Date(log.scheduled_time), "h:mm a")}
                              {log.taken_at && ` • Taken: ${format(new Date(log.taken_at), "h:mm a")}`}
                            </p>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                Note: {log.notes}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className={cn(config.color)}>
                            {config.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
