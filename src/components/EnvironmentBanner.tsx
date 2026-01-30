import { isProduction, getEnvironmentLabel, isE2ETestMode } from "@/lib/environment";

/**
 * Environment Banner
 * 
 * Displays a visual indicator when running in non-production environments.
 * Helps testers and developers quickly identify the current environment.
 */
export function EnvironmentBanner() {
  // Don't show in production
  if (isProduction()) {
    return null;
  }

  const label = getEnvironmentLabel();
  const isE2E = isE2ETestMode();

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-warning text-warning-foreground text-center text-xs font-medium py-1 px-2">
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-warning-foreground/70 animate-pulse" />
        {label} Environment
        {isE2E && <span className="ml-2 px-1.5 py-0.5 bg-warning-foreground/20 text-warning-foreground rounded text-[10px]">E2E Test</span>}
      </span>
    </div>
  );
}
