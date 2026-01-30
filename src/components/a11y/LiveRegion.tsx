/**
 * LiveRegion Component
 * Announces dynamic content changes to screen readers.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export type LiveRegionPoliteness = "polite" | "assertive" | "off";

interface LiveRegionProps {
  /** Content to announce */
  children: React.ReactNode;
  /** How urgently the message should be announced */
  politeness?: LiveRegionPoliteness;
  /** Whether to only announce additions (atomic=false) or full content (atomic=true) */
  atomic?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the region is visible (default: hidden) */
  visible?: boolean;
}

/**
 * Live region for screen reader announcements.
 * Use "polite" for non-urgent updates, "assertive" for important alerts.
 */
export function LiveRegion({
  children,
  politeness = "polite",
  atomic = true,
  className,
  visible = false,
}: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn(
        !visible && "sr-only",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Hook to create announcements for screen readers.
 */
export function useAnnounce() {
  const [message, setMessage] = React.useState<string>("");
  const [politeness, setPoliteness] = React.useState<LiveRegionPoliteness>("polite");
  
  const announce = React.useCallback(
    (text: string, urgency: LiveRegionPoliteness = "polite") => {
      // Clear first to ensure re-announcement
      setMessage("");
      setPoliteness(urgency);
      
      // Set message after a short delay to trigger announcement
      requestAnimationFrame(() => {
        setMessage(text);
      });
    },
    []
  );

  const AnnouncerComponent = React.useCallback(
    () => (
      <LiveRegion politeness={politeness}>
        {message}
      </LiveRegion>
    ),
    [message, politeness]
  );

  return { announce, Announcer: AnnouncerComponent };
}
