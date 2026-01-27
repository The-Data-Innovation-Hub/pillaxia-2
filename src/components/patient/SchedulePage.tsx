import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Calendar } from "lucide-react";
import { TodayScheduleCard } from "./TodayScheduleCard";
import { OfflineSyncIndicator } from "./OfflineSyncIndicator";
import { format, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { useOfflineMedicationLog } from "@/hooks/useOfflineMedicationLog";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useLanguage } from "@/i18n/LanguageContext";

interface MedicationLog {
  id: string;
  scheduled_time: string;
  status: string;
  taken_at: string | null;
  medications: {
    name: string;
    dosage: string;
    dosage_unit: string;
    form: string;
  };
  medication_schedules: {
    quantity: number;
    with_food: boolean;
  };
}

export function SchedulePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { logMedication, isOnline } = useOfflineMedicationLog();

  const fetchTodaysLogs = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data, error } = await supabase
        .from("medication_logs")
        .select(`
          *,
          medications (name, dosage, dosage_unit, form),
          medication_schedules (quantity, with_food)
        `)
        .eq("user_id", user.id)
        .gte("scheduled_time", start)
        .lte("scheduled_time", end)
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Auto-sync hook
  useOfflineSync(fetchTodaysLogs);

  useEffect(() => {
    if (user) {
      fetchTodaysLogs();
    }
  }, [user, fetchTodaysLogs]);

  const generateTodaysLogs = async () => {

    setGenerating(true);
    try {
      // Get all active schedules
      const { data: schedules, error: schedError } = await supabase
        .from("medication_schedules")
        .select(`
          *,
          medications!inner (id, name, is_active)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (schedError) throw schedError;

      const today = new Date();
      const dayOfWeek = today.getDay();

      // Filter schedules for today
      const todaysSchedules = schedules?.filter((s) => 
        s.days_of_week?.includes(dayOfWeek) && s.medications?.is_active
      ) || [];

      // Create logs for each schedule
      const logsToCreate = todaysSchedules.map((schedule) => {
        const [hours, minutes] = schedule.time_of_day.split(":");
        const scheduledTime = new Date(today);
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        return {
          schedule_id: schedule.id,
          medication_id: schedule.medication_id,
          user_id: user.id,
          scheduled_time: scheduledTime.toISOString(),
          status: "pending",
        };
      });

      if (logsToCreate.length > 0) {
        // Check for existing logs to avoid duplicates
        const { data: existingLogs } = await supabase
          .from("medication_logs")
          .select("schedule_id, scheduled_time")
          .eq("user_id", user.id)
          .gte("scheduled_time", startOfDay(today).toISOString())
          .lte("scheduled_time", endOfDay(today).toISOString());

        const existingKeys = new Set(
          existingLogs?.map((l) => `${l.schedule_id}-${l.scheduled_time}`) || []
        );

        const newLogs = logsToCreate.filter(
          (l) => !existingKeys.has(`${l.schedule_id}-${l.scheduled_time}`)
        );

        if (newLogs.length > 0) {
          const { error } = await supabase.from("medication_logs").insert(newLogs);
          if (error) throw error;
          toast.success(`Generated ${newLogs.length} dose reminders for today`);
        } else {
          toast.info("Today's schedule is already up to date");
        }
      } else {
        toast.info("No scheduled medications for today");
      }

      fetchTodaysLogs();
    } catch (error) {
      console.error("Error generating logs:", error);
      toast.error("Failed to generate schedule");
    } finally {
      setGenerating(false);
    }
  };

  const handleTakeDose = async (logId: string) => {
    // Optimistic update for better UX
    setLogs(prev => prev.map(log => 
      log.id === logId 
        ? { ...log, status: "taken", taken_at: new Date().toISOString() }
        : log
    ));

    const success = await logMedication({ logId, status: "taken" });
    
    if (success) {
      if (isOnline) {
        toast.success(t.schedule.taken + "! 💊");
      } else {
        toast.info(t.offline.doseTakenOffline);
      }
    } else {
      // Revert optimistic update on failure
      fetchTodaysLogs();
    }
  };

  const handleSkipDose = async (logId: string) => {
    // Optimistic update
    setLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, status: "skipped" } : log
    ));

    const success = await logMedication({ logId, status: "skipped" });
    
    if (success) {
      if (isOnline) {
        toast.info(t.schedule.skipped);
      } else {
        toast.info(t.offline.doseSkippedOffline);
      }
    } else {
      // Revert optimistic update on failure
      fetchTodaysLogs();
    }
  };

  const pendingCount = logs.filter((l) => l.status === "pending").length;
  const takenCount = logs.filter((l) => l.status === "taken").length;

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
          <h1 className="text-2xl font-bold">{t.schedule.title}</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <OfflineSyncIndicator onSyncComplete={fetchTodaysLogs} />
          <Button onClick={generateTodaysLogs} disabled={generating || !isOnline}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t.common.loading.includes("...") ? "Refresh" : "Refresh Schedule"}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{takenCount}</div>
              <p className="text-sm text-muted-foreground">Taken</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">{pendingCount}</div>
              <p className="text-sm text-muted-foreground">{t.schedule.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{logs.length}</div>
              <p className="text-sm text-muted-foreground">Total Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No doses scheduled</h3>
            <p className="text-muted-foreground mb-4">
              Add medications first, then click "Refresh Schedule" to generate today's doses
            </p>
            <Button onClick={generateTodaysLogs} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Generate Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <TodayScheduleCard
              key={log.id}
              log={{
                id: log.id,
                scheduled_time: log.scheduled_time,
                status: log.status,
                taken_at: log.taken_at || undefined,
                medication: log.medications,
                schedule: log.medication_schedules,
              }}
              onTake={handleTakeDose}
              onSkip={handleSkipDose}
            />
          ))}
        </div>
      )}
    </div>
  );
}
