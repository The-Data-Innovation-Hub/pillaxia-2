import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, X, RefreshCw, Sparkles } from "lucide-react";
import { useOnboarding } from "./OnboardingContext";
import { cn } from "@/lib/utils";

export function OnboardingChecklist() {
  const {
    steps,
    showChecklist,
    setShowChecklist,
    isOnboardingComplete,
    startTour,
    resetOnboarding,
    completeStep,
  } = useOnboarding();
  
  const [isOpen, setIsOpen] = useState(true);

  if (!showChecklist) return null;

  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <Card
      className={cn(
        "fixed bottom-4 right-4 w-80 shadow-lg z-50 transition-all duration-200",
        "border-primary/20"
      )}
      role="region"
      aria-label="Getting started checklist"
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <CardTitle className="text-sm font-medium">
                {isOnboardingComplete ? "All done!" : "Getting Started"}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={isOpen ? "Collapse checklist" : "Expand checklist"}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowChecklist(false)}
                aria-label="Close checklist"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{completedCount} of {steps.length} complete</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress 
              value={progress} 
              className="h-1.5"
              aria-label={`Progress: ${Math.round(progress)}%`}
            />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pb-4">
            <ul className="space-y-2" role="list">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-lg transition-colors",
                    step.completed 
                      ? "bg-muted/50" 
                      : "hover:bg-muted/30 cursor-pointer"
                  )}
                  onClick={() => !step.completed && completeStep(step.id)}
                >
                  <Checkbox
                    id={`step-${step.id}`}
                    checked={step.completed}
                    onCheckedChange={() => completeStep(step.id)}
                    aria-describedby={`step-desc-${step.id}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`step-${step.id}`}
                      className={cn(
                        "text-sm font-medium cursor-pointer",
                        step.completed && "line-through text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </label>
                    <p
                      id={`step-desc-${step.id}`}
                      className="text-xs text-muted-foreground mt-0.5"
                    >
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={startTour}
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Replay Tour
              </Button>
              {isOnboardingComplete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetOnboarding}
                  className="text-muted-foreground"
                >
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
