import { useEffect } from "react";
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
import { Heart, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  caregiver_profile: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function PatientMessagesCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["patient-encouragement-messages", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("caregiver_messages")
        .select("id, message, is_read, created_at, caregiver_user_id")
        .eq("patient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch caregiver profiles
      const caregiverIds = [...new Set(data.map((m) => m.caregiver_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", caregiverIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p]) || []
      );

      return data.map((msg) => ({
        ...msg,
        caregiver_profile: profileMap.get(msg.caregiver_user_id) || null,
      })) as Message[];
    },
    enabled: !!user,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("caregiver_messages")
        .update({ is_read: true })
        .eq("id", messageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patient-encouragement-messages"],
      });
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("patient-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "caregiver_messages",
          filter: `patient_user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["patient-encouragement-messages"],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const unreadCount = messages?.filter((m) => !m.is_read).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-primary" />
              Encouragement Messages
            </CardTitle>
            <CardDescription>
              Messages from your caregivers
            </CardDescription>
          </div>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} new</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-4">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg border ${
                  msg.is_read ? "bg-muted/30" : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {msg.caregiver_profile?.first_name || "Caregiver"}{" "}
                      {msg.caregiver_profile?.last_name || ""}
                    </p>
                    <p className="text-sm mt-1">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(msg.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  {!msg.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => markAsReadMutation.mutate(msg.id)}
                      disabled={markAsReadMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
