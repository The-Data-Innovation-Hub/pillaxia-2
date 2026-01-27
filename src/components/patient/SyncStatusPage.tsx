import { useState, useEffect, useCallback } from "react";
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Clock, 
  Trash2,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { offlineQueue } from "@/lib/offlineQueue";
import { symptomCache, CachedSymptomEntry } from "@/lib/symptomCache";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface PendingAction {
  id?: number;
  type: "medication_log" | "symptom_entry" | "message";
  url: string;
  method: string;
  timestamp: number;
  body: unknown;
}

interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  type: "sync" | "error";
  itemsSynced?: number;
  itemsFailed?: number;
  message: string;
}

const SYNC_HISTORY_KEY = "pillaxia_sync_history";
const MAX_HISTORY_ENTRIES = 20;

export function SyncStatusPage() {
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const { syncPendingActions, syncInProgress, lastSyncTime } = useOfflineSync();
  const { t } = useLanguage();
  
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [pendingSymptoms, setPendingSymptoms] = useState<CachedSymptomEntry[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [showPendingDetails, setShowPendingDetails] = useState(false);
  const [showHistoryDetails, setShowHistoryDetails] = useState(true);

  const loadData = useCallback(async () => {
    // Load pending actions from queue
    const actions = await offlineQueue.getActions();
    setPendingActions(actions);

    // Load pending symptoms from cache
    if (user?.id) {
      const symptoms = await symptomCache.getPendingSymptoms(user.id);
      setPendingSymptoms(symptoms);
    }

    // Load sync history from localStorage
    const storedHistory = localStorage.getItem(SYNC_HISTORY_KEY);
    if (storedHistory) {
      try {
        setSyncHistory(JSON.parse(storedHistory));
      } catch {
        setSyncHistory([]);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const addHistoryEntry = useCallback((entry: Omit<SyncHistoryEntry, "id" | "timestamp">) => {
    const newEntry: SyncHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    
    setSyncHistory((prev) => {
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSync = async () => {
    if (!isOnline || syncInProgress) return;
    
    const pendingCount = await offlineQueue.getPendingCount();
    
    await syncPendingActions();
    
    const remainingCount = await offlineQueue.getPendingCount();
    const synced = pendingCount - remainingCount;
    
    addHistoryEntry({
      type: remainingCount > 0 ? "error" : "sync",
      itemsSynced: synced,
      itemsFailed: remainingCount,
      message: remainingCount > 0 
        ? `Synced ${synced} items, ${remainingCount} failed`
        : `Successfully synced ${synced} items`,
    });
    
    await loadData();
  };

  const handleClearQueue = async () => {
    if (pendingActions.length === 0) return;
    
    setIsClearing(true);
    try {
      await offlineQueue.clearAll();
      addHistoryEntry({
        type: "sync",
        message: `Cleared ${pendingActions.length} pending actions`,
      });
      await loadData();
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearHistory = () => {
    setSyncHistory([]);
    localStorage.removeItem(SYNC_HISTORY_KEY);
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case "medication_log": return "Medication Log";
      case "symptom_entry": return "Symptom Entry";
      case "message": return "Message";
      default: return type;
    }
  };

  const totalPending = pendingActions.length;
  const storageUsed = JSON.stringify(pendingActions).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Sync Status</h1>
        <p className="text-muted-foreground">
          Monitor and manage offline data synchronization
        </p>
      </div>

      {/* Connection Status Banner */}
      <Alert variant={isOnline ? "default" : "destructive"}>
        {isOnline ? (
          <Cloud className="h-4 w-4" />
        ) : (
          <CloudOff className="h-4 w-4" />
        )}
        <AlertTitle>
          {isOnline ? "Connected" : "Offline"}
        </AlertTitle>
        <AlertDescription>
          {isOnline 
            ? "You're online. Data will sync automatically."
            : "You're offline. Changes will be saved locally and synced when connection is restored."
          }
        </AlertDescription>
      </Alert>

      {/* Sync Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Sync Overview
              </CardTitle>
              <CardDescription>
                Current synchronization status and pending items
              </CardDescription>
            </div>
            <Button
              onClick={handleSync}
              disabled={!isOnline || syncInProgress || totalPending === 0}
              className="gap-2"
            >
              {syncInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncInProgress ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">{totalPending}</div>
              <div className="text-sm text-muted-foreground">Pending Items</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold">{pendingSymptoms.length}</div>
              <div className="text-sm text-muted-foreground">Pending Symptoms</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold">{syncHistory.length}</div>
              <div className="text-sm text-muted-foreground">Sync Events</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold">
                {storageUsed > 1024 
                  ? `${(storageUsed / 1024).toFixed(1)}KB` 
                  : `${storageUsed}B`
                }
              </div>
              <div className="text-sm text-muted-foreground">Queue Size</div>
            </div>
          </div>

          {/* Last Sync Time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Last synced: {lastSyncTime 
                ? formatDistanceToNow(lastSyncTime, { addSuffix: true })
                : "Never"
              }
            </span>
          </div>

          {/* Sync Progress (when syncing) */}
          {syncInProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Syncing pending items...</span>
                <span className="text-muted-foreground">Please wait</span>
              </div>
              <Progress value={undefined} className="animate-pulse" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Items Card */}
      <Card>
        <Collapsible open={showPendingDetails} onOpenChange={setShowPendingDetails}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Pending Items</CardTitle>
                <Badge variant={totalPending > 0 ? "secondary" : "outline"}>
                  {totalPending}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {totalPending > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearQueue}
                    disabled={isClearing}
                    className="text-destructive hover:text-destructive"
                  >
                    {isClearing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">Clear Queue</span>
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showPendingDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            <CardDescription>
              Items waiting to be synchronized to the server
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {totalPending === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p>All items are synced!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingActions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {getActionTypeLabel(action.type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {action.method}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(action.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Sync History Card */}
      <Card>
        <Collapsible open={showHistoryDetails} onOpenChange={setShowHistoryDetails}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Sync History</CardTitle>
                <Badge variant="outline">{syncHistory.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {syncHistory.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-1 hidden sm:inline">Clear</span>
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showHistoryDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
            <CardDescription>
              Recent synchronization events and their outcomes
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {syncHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                  <p>No sync history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-start justify-between p-3 rounded-lg border",
                        entry.type === "error" && "border-destructive/50 bg-destructive/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {entry.type === "sync" ? (
                          <Check className="h-4 w-4 text-primary mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{entry.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(entry.timestamp), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      {entry.itemsSynced !== undefined && (
                        <div className="text-right text-xs text-muted-foreground">
                          {entry.itemsSynced > 0 && (
                            <div className="text-primary">{entry.itemsSynced} synced</div>
                          )}
                          {entry.itemsFailed && entry.itemsFailed > 0 && (
                            <div className="text-destructive">{entry.itemsFailed} failed</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Tips Card */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Sync Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Data syncs automatically when you come back online</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Pending items are preserved even if you close the app</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>Sync checks run every 30 seconds when online</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <span>Clearing the queue will permanently delete pending items</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}