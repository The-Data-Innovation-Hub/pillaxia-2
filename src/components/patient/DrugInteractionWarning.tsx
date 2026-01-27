import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, XOctagon } from "lucide-react";
import type { DrugInteraction } from "@/hooks/useDrugInteractions";

interface DrugInteractionWarningProps {
  interactions: DrugInteraction[];
}

const severityConfig = {
  mild: {
    icon: Info,
    variant: "default" as const,
    bgClass: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
    badgeVariant: "secondary" as const,
  },
  moderate: {
    icon: AlertCircle,
    variant: "default" as const,
    bgClass: "border-warning bg-warning/10",
    badgeVariant: "outline" as const,
  },
  severe: {
    icon: AlertTriangle,
    variant: "destructive" as const,
    bgClass: "border-destructive bg-destructive/10",
    badgeVariant: "destructive" as const,
  },
  contraindicated: {
    icon: XOctagon,
    variant: "destructive" as const,
    bgClass: "border-destructive bg-destructive/20",
    badgeVariant: "destructive" as const,
  },
};

export function DrugInteractionWarning({ interactions }: DrugInteractionWarningProps) {
  if (interactions.length === 0) return null;

  // Sort by severity (most severe first)
  const sortedInteractions = [...interactions].sort((a, b) => {
    const order = ["contraindicated", "severe", "moderate", "mild"];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  return (
    <div className="space-y-3">
      {sortedInteractions.map((interaction) => {
        const config = severityConfig[interaction.severity];
        const Icon = config.icon;

        return (
          <Alert key={interaction.id} className={config.bgClass}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Drug Interaction Warning
              <Badge variant={config.badgeVariant} className="capitalize">
                {interaction.severity}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-1">
              <p className="font-medium">
                {interaction.drug_a} + {interaction.drug_b}
              </p>
              <p className="text-sm">{interaction.description}</p>
              {interaction.recommendation && (
                <p className="text-sm font-medium mt-2">
                  Recommendation: {interaction.recommendation}
                </p>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
