import * as Sentry from "@sentry/react";
import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

type FallbackProps = {
  error: unknown;
  resetError: () => void;
  eventId?: string;
  componentStack?: string;
};

const ErrorFallback = forwardRef<HTMLDivElement, FallbackProps>(function ErrorFallback(
  { error, resetError, eventId }: FallbackProps,
  ref
) {
  const safeError = error instanceof Error ? error : new Error(String(error));

  return (
    <div ref={ref} className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred. Our team has been notified and is working on a fix.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {import.meta.env.DEV && (
            <div className="bg-muted p-3 rounded-md overflow-auto max-h-32">
              <code className="text-xs text-muted-foreground">
                {safeError.message}
              </code>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button onClick={resetError} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = "/"}
              className="w-full"
            >
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Error ID: {eventId || "Unknown"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

interface SentryErrorBoundaryProps {
  children: React.ReactNode;
}

export function SentryErrorBoundary({ children }: SentryErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError, eventId, componentStack }) => (
        <ErrorFallback
          error={error}
          resetError={resetError}
          eventId={eventId}
          componentStack={componentStack}
        />
      )}
      showDialog
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
