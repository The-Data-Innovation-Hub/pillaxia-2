import { useSessionManager } from "@/hooks/useSessionManager";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

export function SessionTimeoutWarning() {
  const { remainingTime, extendSession } = useSessionManager();

  const isVisible = remainingTime !== null && remainingTime > 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AlertDialog open={isVisible}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-accent-foreground" />
            Session Expiring
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Your session will expire in{" "}
              <span className="font-bold text-foreground">
                {remainingTime ? formatTime(remainingTime) : "0:00"}
              </span>{" "}
              due to inactivity.
            </p>
            <p>Click "Stay Logged In" to continue your session.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={extendSession}>Stay Logged In</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
