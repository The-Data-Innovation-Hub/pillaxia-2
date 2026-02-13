import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfileByUserId, createClinicianMessage, apiInvoke } from "@/integrations/azure/data";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, Loader2, Send } from "lucide-react";

interface ClinicianEncouragementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientUserId: string;
  patientName: string;
}

const QUICK_MESSAGES = [
  "Great job staying on track with your medications! 💪",
  "Your dedication to your health is truly inspiring! ❤️",
  "Keep up the excellent work managing your health! 🌟",
  "We noticed your progress - you're doing fantastic! 👏",
];

export function ClinicianEncouragementDialog({
  open,
  onOpenChange,
  patientUserId,
  patientName,
}: ClinicianEncouragementDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: clinicianProfile } = useQuery({
    queryKey: ["clinician-profile", user?.id],
    queryFn: async () => (user?.id ? getProfileByUserId(user.id) : null),
    enabled: !!user?.id,
  });

  const clinicianName = clinicianProfile
    ? `${(clinicianProfile as Record<string, unknown>).first_name || ""} ${(clinicianProfile as Record<string, unknown>).last_name || ""}`.trim() || "Your care team"
    : "Your care team";

  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!user) throw new Error("Not authenticated");
      await createClinicianMessage({
        clinician_user_id: user.id,
        patient_user_id: patientUserId,
        message: messageText.trim(),
        sender_type: "clinician",
      });
      try {
        await apiInvoke("send-clinician-message-notification", {
          patient_user_id: patientUserId,
          clinician_name: clinicianName,
          message: messageText.trim(),
          is_encouragement: true,
        });
      } catch (notifError) {
        console.error("Failed to send notification:", notifError);
      }
    },
    onSuccess: () => {
      toast({
        title: "Encouragement sent!",
        description: `Your message was sent to ${patientName}.`,
      });
      setMessage("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["clinician-messages"] });
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send",
        description: "Could not send your message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  const handleQuickMessage = (quickMsg: string) => {
    setMessage(quickMsg);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Send Encouragement
          </DialogTitle>
          <DialogDescription>
            Send a supportive message to {patientName} to encourage their health journey.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Quick messages</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_MESSAGES.map((quickMsg, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-1.5 px-2"
                  onClick={() => handleQuickMessage(quickMsg)}
                >
                  {quickMsg.slice(0, 30)}...
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Your message</Label>
            <Textarea
              id="message"
              placeholder="Write your encouragement message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
