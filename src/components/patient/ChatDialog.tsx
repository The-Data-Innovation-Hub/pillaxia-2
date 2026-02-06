import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { db } from "@/integrations/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Check, CheckCheck, BellOff } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caregiverId: string;
  caregiverName: string;
  patientId: string;
  viewerRole: "patient" | "caregiver";
}

interface Message {
  id: string;
  message: string;
  sender_type: "caregiver" | "patient";
  is_read: boolean;
  created_at: string;
}

const ChatDialog = ({
  open,
  onOpenChange,
  caregiverId,
  caregiverName,
  patientId,
  viewerRole,
}: ChatDialogProps) => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if notifications are enabled (only admins can see settings)
  const { isEnabled } = useNotificationSettings();
  const notificationsEnabled = isAdmin ? isEnabled("encouragement_messages") : true;

  // Fetch messages for this conversation
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat-messages", caregiverId, patientId],
    queryFn: async () => {
      const { data, error } = await db
        .from("caregiver_messages")
        .select("id, message, sender_type, is_read, created_at")
        .eq("caregiver_user_id", caregiverId)
        .eq("patient_user_id", patientId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: open,
    refetchInterval: 3000,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const senderType = viewerRole;
      
      const { error } = await db.from("caregiver_messages").insert({
        caregiver_user_id: caregiverId,
        patient_user_id: patientId,
        message: text,
        sender_type: senderType,
        is_read: false,
      });

      if (error) throw error;

      // Send WhatsApp notification (fire and forget)
      db.functions.invoke("send-whatsapp-notification", {
        body: {
          recipientId: viewerRole === "patient" ? caregiverId : patientId,
          senderName: viewerRole === "patient" ? "Your patient" : caregiverName,
          message: text,
        },
      }).catch(console.error);
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", caregiverId, patientId] });
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  // Mark messages as read
  useEffect(() => {
    if (!open || !messages.length || !user) return;

    const unreadMessages = messages.filter(
      (m) =>
        !m.is_read &&
        ((viewerRole === "patient" && m.sender_type === "caregiver") ||
          (viewerRole === "caregiver" && m.sender_type === "patient"))
    );

    if (unreadMessages.length > 0) {
      db
        .from("caregiver_messages")
        .update({ is_read: true })
        .in("id", unreadMessages.map((m) => m.id))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["chat-messages", caregiverId, patientId] });
          queryClient.invalidateQueries({ queryKey: ["patient-messages"] });
          queryClient.invalidateQueries({ queryKey: ["caregiver-unread"] });
        });
    }
  }, [open, messages, user, viewerRole, caregiverId, patientId, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = () => {
    const text = newMessage.trim();
    if (!text) return;
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "h:mm a");
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM d, yyyy");
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(msg);
    return acc;
  }, {} as Record<string, Message[]>);

  const isMyMessage = (msg: Message) => msg.sender_type === viewerRole;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md h-[600px] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-lg">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-primary-foreground/20">
              <AvatarFallback className="text-primary-foreground">
                {caregiverName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <DialogTitle className="text-primary-foreground font-semibold">
              {caregiverName}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <ScrollArea 
          className="flex-1 px-4 py-2 bg-gradient-to-b from-muted/30 to-muted/10" 
          ref={scrollRef}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p className="text-center">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
                <div key={dateKey}>
                  {/* Date header */}
                  <div className="flex justify-center my-3">
                    <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                      {formatDateHeader(dayMessages[0].created_at)}
                    </span>
                  </div>

                  {/* Messages for this date */}
                  <div className="space-y-1">
                    {dayMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${isMyMessage(msg) ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                            isMyMessage(msg)
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-card text-card-foreground border rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          <div
                            className={`flex items-center gap-1 mt-1 text-xs ${
                              isMyMessage(msg) ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}
                          >
                            <span>{formatMessageTime(msg.created_at)}</span>
                            {isMyMessage(msg) && (
                              msg.is_read ? (
                                <CheckCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t bg-background space-y-2">
          {!notificationsEnabled && (
            <Alert className="py-2 px-3 border-amber-500/50 bg-amber-500/10">
              <BellOff className="h-3.5 w-3.5 text-amber-600" />
              <AlertDescription className="text-xs text-amber-700">
                Notifications disabled — messages saved but no alerts sent.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendMutation.isPending}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!newMessage.trim() || sendMutation.isPending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatDialog;
