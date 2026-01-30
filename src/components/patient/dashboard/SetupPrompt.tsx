/**
 * Setup prompt card for new users.
 * Prompts users to configure notification preferences.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface SetupPromptProps {
  onSetupClick: () => void;
}

export function SetupPrompt({ onSetupClick }: SetupPromptProps) {
  return (
    <Card 
      className="border-primary/30 bg-primary/5"
      role="alert"
      aria-live="polite"
    >
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center"
            aria-hidden="true"
          >
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Set up your notifications</h3>
            <p className="text-sm text-muted-foreground">
              Configure how you'd like to receive medication reminders
            </p>
          </div>
        </div>
        <Button 
          onClick={onSetupClick}
          aria-label="Open notification setup wizard"
        >
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
