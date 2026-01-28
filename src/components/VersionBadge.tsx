import { getVersionDisplay, VERSION_INFO } from "@/lib/version";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VersionBadgeProps {
  variant?: "default" | "minimal" | "detailed";
  className?: string;
}

export function VersionBadge({ variant = "default", className = "" }: VersionBadgeProps) {
  const versionDisplay = getVersionDisplay();
  
  if (variant === "minimal") {
    return (
      <span className={`text-xs text-muted-foreground ${className}`}>
        {versionDisplay}
      </span>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        <span className="font-medium">{versionDisplay}</span>
        <span className="ml-1 opacity-70">({VERSION_INFO.environment})</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-default ${className}`}
          >
            {versionDisplay}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <p className="font-medium">Pillaxia {versionDisplay}</p>
            <p className="text-muted-foreground">
              Environment: {VERSION_INFO.environment}
            </p>
            <p className="text-muted-foreground">
              Build: {VERSION_INFO.buildDate}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
