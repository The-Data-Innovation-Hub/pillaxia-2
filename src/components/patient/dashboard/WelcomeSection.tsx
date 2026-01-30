/**
 * Welcome section for the patient dashboard.
 * Displays greeting, date, and Ask Angela button.
 */
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Profile } from "@/hooks/useAuthState";

interface WelcomeSectionProps {
  profile: Profile | null;
}

/**
 * Returns a greeting based on the current hour.
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeSection({ profile }: WelcomeSectionProps) {
  const navigate = useNavigate();
  const greeting = getGreeting();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold break-words">
          {greeting}, {profile?.first_name || "there"}! 👋
        </h1>
        <p className="text-muted-foreground">
          <time dateTime={new Date().toISOString()}>
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </time>
        </p>
      </div>
      <Button
        onClick={() => navigate("/dashboard/angela")}
        className="gap-2 w-full sm:w-auto shrink-0"
        aria-label="Open AI assistant Angela"
      >
        <Bot className="h-4 w-4" aria-hidden="true" />
        Ask Angela
      </Button>
    </div>
  );
}
