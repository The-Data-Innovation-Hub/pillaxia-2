import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Stethoscope, MessageCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ClinicianChatDialog } from "@/components/clinician/ClinicianChatDialog";

interface Conversation {
  clinician_user_id: string;
  clinician_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

export function ClinicianMessagesCard() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Fetch patient profile for name
  const { data: patientProfile } = useQuery({
    queryKey: ["patient-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await db
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const patientName = patientProfile
    ? `${patientProfile.first_name || ""} ${patientProfile.last_name || ""}`.trim() || "Patient"
    : "Patient";

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["patient-clinician-messages", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all messages for this patient from clinicians
      const { data, error } = await db
        .from("clinician_messages")
        .select("id, message, is_read, created_at, clinician_user_id, sender_type")
        .eq("patient_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Group by clinician
      const clinicianIds = [...new Set(data.map((m) => m.clinician_user_id))];
      
      // Fetch clinician profiles
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", clinicianIds);

      const profileMap = new Map(
        profiles?.map((p: any) => [p.user_id, p]) || []
      );

      // Build conversation summaries
      const convMap = new Map<string, Conversation>();
      for (const msg of data) {
        if (!convMap.has(msg.clinician_user_id)) {
          const profile = profileMap.get(msg.clinician_user_id) as any;
          convMap.set(msg.clinician_user_id, {
            clinician_user_id: msg.clinician_user_id,
            clinician_name: profile?.first_name 
              ? `Dr. ${profile.first_name} ${profile.last_name || ""}`.trim()
              : "Your Clinician",
            last_message: msg.message,
            last_message_time: msg.created_at,
            unread_count: 0,
          });
        }
        // Count unread messages from clinician
        if (!msg.is_read && msg.sender_type === "clinician") {
          const conv = convMap.get(msg.clinician_user_id)!;
          conv.unread_count++;
        }
      }

      return Array.from(convMap.values());
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

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
                <Stethoscope className="h-5 w-5 text-primary" />
                Clinician Messages
              </CardTitle>
              <CardDescription>
                Chat with your healthcare providers
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
                  key={conv.clinician_user_id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                    conv.unread_count > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{conv.clinician_name}</p>
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
        <ClinicianChatDialog
          open={!!selectedConversation}
          onOpenChange={(open) => !open && setSelectedConversation(null)}
          clinicianId={selectedConversation.clinician_user_id}
          clinicianName={selectedConversation.clinician_name}
          patientId={user.id}
          patientName={patientName}
          viewerRole="patient"
        />
      )}
    </>
  );
}
