import * as Sentry from "@sentry/react";

// Initialize Sentry for error tracking and performance monitoring
export function initSentry() {
  // In Lovable preview/dev, build-time Vite env vars may not always include VITE_SENTRY_DSN.
  // We fall back to a backend function which reads the DSN from server-side env.
  void ensureSentryInitialized();
}

let sentryInitPromise: Promise<void> | null = null;
let sentryInitialized = false;

async function ensureSentryInitialized(): Promise<void> {
  if (sentryInitialized) return;
  if (sentryInitPromise) return sentryInitPromise;

  sentryInitPromise = (async () => {
    const dsn = await resolveSentryDsn();
    if (!dsn) {
      console.warn("Sentry DSN not configured. Error tracking is disabled.");
      return;
    }

    Sentry.init({
      dsn,
    
    // Performance Monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in dev
    
    // Session Replay for debugging
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Environment
    environment: import.meta.env.PROD ? "production" : "development",
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || "1.0.0",
    
    // Integration-specific settings
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true, // Privacy: mask all text
        blockAllMedia: true, // Privacy: block media
      }),
    ],
    
    // Filter out noisy errors
    ignoreErrors: [
      // Network errors
      "Failed to fetch",
      "NetworkError",
      "Load failed",
      // Browser extensions
      "chrome-extension://",
      "moz-extension://",
      // Known benign errors
      "ResizeObserver loop",
      "Non-Error promise rejection",
    ],
    
    // Before sending events
    beforeSend(event) {
      // Always send events - Sentry DSN presence is sufficient gate.
      // In development/preview, you can still see events in Sentry dashboard.
      return event;
    },
    
    // Before sending transactions (performance data)
    beforeSendTransaction(event) {
      // Filter out health check transactions
      if (event.transaction?.includes("/health")) {
        return null;
      }
      return event;
    },
  });

    sentryInitialized = true;
    console.log("[Sentry] Initialized successfully");
  })();

  return sentryInitPromise;
}

let cachedRuntimeDsn: string | null = null;

async function resolveSentryDsn(): Promise<string | null> {
  if (cachedRuntimeDsn) return cachedRuntimeDsn;

  const fromEnv = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (fromEnv) {
    cachedRuntimeDsn = fromEnv;
    return cachedRuntimeDsn;
  }

  const fromBackend = await fetchSentryDsnFromBackend();
  if (fromBackend) {
    cachedRuntimeDsn = fromBackend;
    return cachedRuntimeDsn;
  }

  return null;
}

async function fetchSentryDsnFromBackend(): Promise<string | null> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
    const functionsUrl = import.meta.env.VITE_FUNCTIONS_URL as string | undefined;
    const baseUrl = functionsUrl || apiUrl;
    if (!baseUrl) return null;

    const res = await fetch(`${baseUrl}/api/get-sentry-dsn`, {
      method: "GET",
    });

    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { dsn?: string | null } | null;
    const dsn = (json?.dsn || "").trim();
    return dsn.length > 0 ? dsn : null;
  } catch {
    return null;
  }
}

// Helper to set user context when they log in
export function setSentryUser(user: { id: string; email?: string; role?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}

// Clear user context on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Add custom context for debugging
export function setSentryContext(name: string, data: Record<string, unknown>) {
  Sentry.setContext(name, data);
}

// Capture a custom error with additional context
export function captureError(
  error: Error | string,
  context?: Record<string, unknown>
) {
  if (context) {
    Sentry.setContext("custom", context);
  }
  
  if (typeof error === "string") {
    Sentry.captureMessage(error, "error");
  } else {
    Sentry.captureException(error);
  }
}

// Capture a message/log
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "log" | "info" | "debug" = "info"
) {
  Sentry.captureMessage(message, level);
}

// Start a custom transaction for performance monitoring
export function startTransaction(name: string, op: string) {
  return Sentry.startInactiveSpan({ name, op });
}

// Add breadcrumb for debugging
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

// Export Sentry for direct usage
export { Sentry };
