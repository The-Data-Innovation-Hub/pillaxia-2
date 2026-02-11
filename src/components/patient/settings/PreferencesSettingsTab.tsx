import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { AutoResolutionSettingsCard } from "@/components/patient/AutoResolutionSettingsCard";
import { TimezoneSelector } from "@/components/patient/TimezoneSelector";
import { NotificationSchedulingCard } from "@/components/patient/NotificationSchedulingCard";
import { PharmacyPreferencesCard } from "@/components/patient/PharmacyPreferencesCard";
import { medicationCache, scheduleCache, symptomCache } from "@/lib/cache";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  RefreshCw,
  Database,
  CheckCircle,
  WifiOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export function PreferencesSettingsTab() {
  const { user } = useAuth();
  const { t, language, setLanguage, languages, isLoading: langLoading } = useLanguage();
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineStatus();
  
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    at: Date;
    success: boolean;
    medicationsCount: number;
    scheduleCount: number;
    symptomsCount: number;
  } | null>(null);

  const handleManualSync = useCallback(async () => {
    if (!user || !isOnline) {
      toast({
        title: "Cannot sync",
        description: isOnline ? "Please sign in first" : "You're offline. Connect to the internet to sync.",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    let medicationsCount = 0;
    let scheduleCount = 0;
    let symptomsCount = 0;

    try {
      // Sync medications
      const { data: medications, error: medError } = await supabase
        .from("medications")
        .select(`
          *,
          medication_schedules (time_of_day, quantity)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (medError) throw medError;
      
      if (medications) {
        await medicationCache.saveMedications(user.id, medications as unknown[]);
        medicationsCount = medications.length;
      }

      // Sync today's schedule
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data: logs, error: logError } = await supabase
        .from("medication_logs")
        .select(`
          id,
          scheduled_time,
          status,
          taken_at,
          medications (name, dosage, dosage_unit, form),
          medication_schedules (quantity, with_food)
        `)
        .eq("user_id", user.id)
        .gte("scheduled_time", startOfDay)
        .lte("scheduled_time", endOfDay)
        .order("scheduled_time", { ascending: true });

      if (logError) throw logError;

      if (logs) {
        await scheduleCache.saveTodaysSchedule(user.id, logs as unknown[]);
        scheduleCount = logs.length;
      }

      // Sync symptoms
      const { data: symptoms, error: symptomError } = await supabase
        .from("symptom_entries")
        .select(`
          *,
          medications (name)
        `)
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (symptomError) throw symptomError;

      if (symptoms) {
        await symptomCache.saveSymptoms(user.id, symptoms as unknown[]);
        symptomsCount = symptoms.length;
      }

      setLastSyncResult({
        at: new Date(),
        success: true,
        medicationsCount,
        scheduleCount,
        symptomsCount,
      });

      toast({
        title: "Sync complete",
        description: `Updated ${medicationsCount} medications, ${scheduleCount} scheduled doses, and ${symptomsCount} symptoms.`,
      });

      queryClient.invalidateQueries({ queryKey: ["medications"] });
      queryClient.invalidateQueries({ queryKey: ["medication-logs"] });
      queryClient.invalidateQueries({ queryKey: ["symptoms"] });

    } catch (error) {
      console.error("Sync failed:", error);
      setLastSyncResult({
        at: new Date(),
        success: false,
        medicationsCount: 0,
        scheduleCount: 0,
        symptomsCount: 0,
      });
      toast({
        title: "Sync failed",
        description: "Could not refresh your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [user, isOnline, queryClient]);

  return (
    <div className="space-y-6">
      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t.settings.language}
          </CardTitle>
          <CardDescription>
            {t.settings.languageSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="font-medium">{t.settings.language}</Label>
                <p className="text-sm text-muted-foreground">
                  {t.settings.languageSubtitle}
                </p>
              </div>
            </div>
            <Select
              value={language}
              onValueChange={(value: string) => setLanguage(value)}
              disabled={langLoading}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex flex-col">
                      <span>{lang.nativeName}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timezone Settings */}
      <TimezoneSelector />

      {/* Data Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Offline Data Sync
          </CardTitle>
          <CardDescription>
            Sync your medications and schedule for offline access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isOnline && (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                You're currently offline. Connect to the internet to sync your data.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="font-medium">Refresh All Data</Label>
                <p className="text-sm text-muted-foreground">
                  Force sync medications and today's schedule from the server
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={syncing || !isOnline}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>

          {lastSyncResult && (
            <>
              <Separator />
              <div className="flex items-center gap-3 text-sm">
                {lastSyncResult.success ? (
                  <CheckCircle className="h-4 w-4 text-primary" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <div>
                  <p className="font-medium">
                    {lastSyncResult.success ? "Last sync successful" : "Last sync failed"}
                  </p>
                  <p className="text-muted-foreground">
                    {lastSyncResult.success
                      ? `${lastSyncResult.medicationsCount} medications, ${lastSyncResult.scheduleCount} doses, ${lastSyncResult.symptomsCount} symptoms`
                      : "Please try again"
                    }
                    {" • "}
                    {lastSyncResult.at.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Auto-Resolution Settings */}
      <AutoResolutionSettingsCard />

      {/* Notification Scheduling */}
      <NotificationSchedulingCard />

      {/* Pharmacy Preferences - Nigeria Availability Alerts */}
      <PharmacyPreferencesCard />
    </div>
  );
}
