import { getVersionDisplay, getFullVersion, VERSION_INFO } from "@/lib/version";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChangelogDialog } from "@/components/ChangelogDialog";

interface VersionBadgeProps {
  variant?: "default" | "minimal" | "detailed" | "full";
  className?: string;
}

export function VersionBadge({ variant = "default", className = "" }: VersionBadgeProps) {
  const shortVersion = getVersionDisplay();
  const fullVersion = getFullVersion();
  
  if (variant === "minimal") {
    return (
      <ChangelogDialog>
        <span className={`text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors ${className}`}>
          {shortVersion}
        </span>
      </ChangelogDialog>
    );
  }

  if (variant === "full") {
    return (
      <ChangelogDialog>
        <span className={`text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors ${className}`}>
          {fullVersion}
        </span>
      </ChangelogDialog>
    );
  }

  if (variant === "detailed") {
    return (
      <ChangelogDialog>
        <div className={`text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors ${className}`}>
          <span className="font-medium">{fullVersion}</span>
          <span className="ml-1 opacity-70">({VERSION_INFO.environment})</span>
        </div>
      </ChangelogDialog>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ChangelogDialog>
            <span 
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer ${className}`}
            >
              {shortVersion}
            </span>
          </ChangelogDialog>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">Pillaxia {fullVersion}</p>
            <p className="text-muted-foreground">
              Build: {VERSION_INFO.buildNumber}
            </p>
            <p className="text-muted-foreground">
              Date: {VERSION_INFO.buildDate}
            </p>
            <p className="text-muted-foreground">
              Environment: {VERSION_INFO.environment}
            </p>
            <p className="text-primary text-[10px] mt-1">Click to view changelog</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
