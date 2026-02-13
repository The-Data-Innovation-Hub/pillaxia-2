import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listCaregiverMessages, listProfilesByUserIds } from "@/integrations/azure/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, MessageCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import ChatDialog from "./ChatDialog";

interface Conversation {
  caregiver_user_id: string;
  caregiver_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export function PatientMessagesCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["patient-messages", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const data = await listCaregiverMessages({ patient_user_id: user.id });
      const sorted = (data || []).sort(
        (a, b) =>
          new Date((b.created_at as string) || 0).getTime() -
          new Date((a.created_at as string) || 0).getTime()
      );
      if (sorted.length === 0) return [];

      const caregiverIds = [...new Set(sorted.map((m) => m.caregiver_user_id as string))];
      const profiles = await listProfilesByUserIds(caregiverIds);
      const profileMap = new Map(
        (profiles || []).map((p) => [(p.user_id as string) ?? (p as { user_id?: string }).user_id!, p])
      );

      const convMap = new Map<string, Conversation>();
      for (const msg of sorted) {
        const cid = msg.caregiver_user_id as string;
        if (!convMap.has(cid)) {
          const profile = profileMap.get(cid) as { first_name?: string; last_name?: string } | undefined;
          convMap.set(cid, {
            caregiver_user_id: cid,
            caregiver_name: profile?.first_name
              ? `${profile.first_name} ${profile.last_name || ""}`.trim()
              : "Caregiver",
            last_message: msg.message as string,
            last_message_time: msg.created_at as string,
            unread_count: 0,
          });
        }
        if (!msg.is_read && msg.sender_type === "caregiver") {
          const conv = convMap.get(cid)!;
          conv.unread_count++;
        }
      }
      return Array.from(convMap.values());
    },
    enabled: !!user,
  });

  // Poll for new messages (realtime removed)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["patient-messages"] });
    }, 15000);
    return () => clearInterval(interval);
  }, [user, queryClient]);

  const totalUnread = conversations?.reduce((acc, c) => acc + c.unread_count, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!conversations || conversations.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-primary" />
                Caregiver Messages
              </CardTitle>
              <CardDescription>
                Chat with your caregivers
              </CardDescription>
            </div>
            {totalUnread > 0 && (
              <Badge variant="default">{totalUnread} new</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.caregiver_user_id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                    conv.unread_count > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{conv.caregiver_name}</p>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="h-5 px-1.5 text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {conv.last_message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(conv.last_message_time), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedConversation && user && (
        <ChatDialog
          open={!!selectedConversation}
          onOpenChange={(open) => !open && setSelectedConversation(null)}
          caregiverId={selectedConversation.caregiver_user_id}
          caregiverName={selectedConversation.caregiver_name}
          patientId={user.id}
          viewerRole="patient"
        />
      )}
    </>
  );
}
