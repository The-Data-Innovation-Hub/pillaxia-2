import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useOnboarding } from "./OnboardingContext";
import { cn } from "@/lib/utils";

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourOverlay() {
  const { showTour, tourSteps, currentTourStep, nextTourStep, prevTourStep, endTour } = useOnboarding();
  const [targetPosition, setTargetPosition] = useState<Position | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const currentStep = tourSteps[currentTourStep];

  const updatePositions = useCallback(() => {
    if (!currentStep) return;

    const target = document.querySelector(currentStep.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetPosition({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });

      // Calculate tooltip position based on placement
      const placement = currentStep.placement || "bottom";
      const tooltipWidth = 320;
      const tooltipHeight = 180;
      const padding = 16;

      let top = 0;
      let left = 0;

      switch (placement) {
        case "top":
          top = rect.top + window.scrollY - tooltipHeight - padding;
          left = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
          break;
        case "bottom":
          top = rect.top + window.scrollY + rect.height + padding;
          left = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
          break;
        case "left":
          top = rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2;
          left = rect.left + window.scrollX - tooltipWidth - padding;
          break;
        case "right":
          top = rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2;
          left = rect.left + window.scrollX + rect.width + padding;
          break;
      }

      // Keep tooltip in viewport
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

      setTooltipPosition({ top, left });
    } else {
      // If target not found, center the tooltip
      setTargetPosition(null);
      setTooltipPosition({
        top: window.innerHeight / 2 - 90,
        left: window.innerWidth / 2 - 160,
      });
    }
  }, [currentStep]);

  useEffect(() => {
    if (!showTour) return;

    updatePositions();
    window.addEventListener("resize", updatePositions);
    window.addEventListener("scroll", updatePositions);

    return () => {
      window.removeEventListener("resize", updatePositions);
      window.removeEventListener("scroll", updatePositions);
    };
  }, [showTour, currentTourStep, updatePositions]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!showTour) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        endTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        nextTourStep();
      } else if (e.key === "ArrowLeft") {
        prevTourStep();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showTour, endTour, nextTourStep, prevTourStep]);

  if (!showTour || !currentStep) return null;

  return (
    <div 
      className="fixed inset-0 z-[100]" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      {/* Overlay with spotlight effect */}
      <div className="absolute inset-0 bg-black/60 transition-opacity duration-300" />
      
      {/* Spotlight cutout */}
      {targetPosition && (
        <div
          className="absolute bg-transparent ring-4 ring-primary rounded-lg transition-all duration-300"
          style={{
            top: targetPosition.top - 4,
            left: targetPosition.left - 4,
            width: targetPosition.width + 8,
            height: targetPosition.height + 8,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
          }}
        />
      )}

      {/* Tooltip */}
      <Card
        className={cn(
          "absolute w-80 shadow-2xl border-primary/20 bg-card",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle id="tour-title" className="text-lg">
              {currentStep.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={endTour}
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{currentStep.content}</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  index === currentTourStep ? "bg-primary" : "bg-muted"
                )}
                aria-hidden="true"
              />
            ))}
          </div>
          <div className="flex gap-2">
            {currentTourStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={prevTourStep}
                aria-label="Previous step"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={nextTourStep}
              aria-label={currentTourStep === tourSteps.length - 1 ? "Finish tour" : "Next step"}
            >
              {currentTourStep === tourSteps.length - 1 ? "Finish" : "Next"}
              {currentTourStep < tourSteps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Skip button */}
      <Button
        variant="secondary"
        className="fixed bottom-4 right-4"
        onClick={endTour}
      >
        Skip tour
      </Button>
    </div>
  );
}
