import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

      // Get all messages for this patient
      const { data, error } = await supabase
        .from("caregiver_messages")
        .select("id, message, is_read, created_at, caregiver_user_id, sender_type")
        .eq("patient_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by caregiver
      const caregiverIds = [...new Set(data.map((m) => m.caregiver_user_id))];
      
      // Fetch caregiver profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", caregiverIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p]) || []
      );

      // Build conversation summaries
      const convMap = new Map<string, Conversation>();
      for (const msg of data) {
        if (!convMap.has(msg.caregiver_user_id)) {
          const profile = profileMap.get(msg.caregiver_user_id);
          convMap.set(msg.caregiver_user_id, {
            caregiver_user_id: msg.caregiver_user_id,
            caregiver_name: profile?.first_name 
              ? `${profile.first_name} ${profile.last_name || ""}`.trim()
              : "Caregiver",
            last_message: msg.message,
            last_message_time: msg.created_at,
            unread_count: 0,
          });
        }
        // Count unread messages from caregiver
        if (!msg.is_read && msg.sender_type === "caregiver") {
          const conv = convMap.get(msg.caregiver_user_id)!;
          conv.unread_count++;
        }
      }

      return Array.from(convMap.values());
    },
    enabled: !!user,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("patient-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "caregiver_messages",
          filter: `patient_user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patient-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
