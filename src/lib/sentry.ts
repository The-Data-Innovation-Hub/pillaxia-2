import * as Sentry from "@sentry/react";

// Initialize Sentry for error tracking and performance monitoring
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
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
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled.
      // In Lovable preview/dev, we allow opt-in via env OR (session/local) storage.
      const devEnabledByEnv = import.meta.env.VITE_SENTRY_DEV_ENABLED === "true";
      const devEnabledByStorage = (() => {
        try {
          const sessionFlag = window.sessionStorage?.getItem("sentry_dev_enabled") === "true";
          const localFlag = window.localStorage?.getItem("sentry_dev_enabled") === "true";
          return sessionFlag || localFlag;
        } catch {
          return false;
        }
      })();

      if (!import.meta.env.PROD && !devEnabledByEnv && !devEnabledByStorage) {
        console.log("[Sentry] Event captured in dev mode (suppressed):", event);
        return null;
      }
      
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

  console.log("[Sentry] Initialized successfully");
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
