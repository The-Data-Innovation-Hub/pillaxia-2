import { useCallback, useMemo, useState } from "react";
import { db } from "@/integrations/db";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";

type PermissionState = "default" | "granted" | "denied" | "prompt";

type DiagnosticState = {
  permission: PermissionState;
  hasServiceWorker: boolean;
  serviceWorkerScriptUrl?: string;
  hasBrowserSubscription: boolean;
  browserEndpoint?: string;
  backendCount: number | null;
  backendEndpoints: string[];
};

function compactEndpoint(endpoint: string, max = 60) {
  if (endpoint.length <= max) return endpoint;
  return `${endpoint.slice(0, max)}…`;
}

function formatUnknownError(err: unknown): string {
  const anyErr = err as any;
  const name = typeof anyErr?.name === "string" ? anyErr.name : undefined;
  const message =
    typeof anyErr?.message === "string"
      ? anyErr.message
      : typeof err === "string"
        ? err
        : "Unknown error";
  const status = anyErr?.context?.status ?? anyErr?.status;
  const statusPart = typeof status === "number" ? `HTTP ${status}` : undefined;
  return [name, statusPart, message].filter(Boolean).join(" — ");
}

export function PushDebugPanel(props: {
  userId?: string;
  isSupported: boolean;
  permission: PermissionState;
  lastTestResult?: { at: string; ok: boolean; summary: string } | null;
}) {
  const { userId, isSupported, permission, lastTestResult } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [diag, setDiag] = useState<DiagnosticState | null>(null);

  const canRun = isSupported && !!userId;

  const runDiagnostics = useCallback(async () => {
    if (!canRun) return;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

      const { data, error, count } = await db
        .from("push_subscriptions")
        .select("endpoint", { count: "exact" })
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      setDiag({
        permission,
        hasServiceWorker: !!registration,
        serviceWorkerScriptUrl: registration?.active?.scriptURL,
        hasBrowserSubscription: !!subscription,
        browserEndpoint: subscription?.endpoint,
        backendCount: count ?? (data?.length ?? 0),
        backendEndpoints: (data ?? []).map((r) => r.endpoint),
      });
    } catch (e) {
      const msg = formatUnknownError(e);
      toast({
        title: "Push debug failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [canRun, permission, userId]);

  const computed = useMemo(() => {
    if (!diag) return null;
    return {
      sw: diag.hasServiceWorker ? "registered" : "missing",
      sub: diag.hasBrowserSubscription ? "present" : "missing",
      backend: diag.backendCount === null ? "unknown" : String(diag.backendCount),
    };
  }, [diag]);

  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer select-none text-sm font-medium">
        Advanced push debug
      </summary>

      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Collects browser + backend subscription info.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runDiagnostics}
            disabled={!canRun || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Run</span>
          </Button>
        </div>

        <Separator />

        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Permission</span>
            <span className="font-mono">{permission}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Service worker</span>
            <span className="font-mono">{computed?.sw ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Browser subscription</span>
            <span className="font-mono">{computed?.sub ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Backend subscriptions</span>
            <span className="font-mono">{computed?.backend ?? "—"}</span>
          </div>
        </div>

        {diag?.serviceWorkerScriptUrl && (
          <div className="text-xs text-muted-foreground">
            SW: <span className="font-mono">{diag.serviceWorkerScriptUrl}</span>
          </div>
        )}

        {diag?.browserEndpoint && (
          <div className="text-xs text-muted-foreground">
            Browser endpoint: <span className="font-mono">{compactEndpoint(diag.browserEndpoint)}</span>
          </div>
        )}

        {diag && diag.backendEndpoints.length > 0 && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div>Backend endpoints:</div>
            <ul className="list-disc pl-5">
              {diag.backendEndpoints.map((ep) => (
                <li key={ep} className="font-mono">
                  {compactEndpoint(ep)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {lastTestResult && (
          <div className="text-xs">
            <div className="text-muted-foreground">Last test ({lastTestResult.at}):</div>
            <div className={lastTestResult.ok ? "text-primary" : "text-destructive"}>
              {lastTestResult.summary}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
