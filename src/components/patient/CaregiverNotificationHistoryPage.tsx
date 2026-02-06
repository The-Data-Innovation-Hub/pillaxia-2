import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MessageCircle,
  Pill,
  User,
  XCircle,
} from "lucide-react";
import { format, subDays } from "date-fns";

interface MissedDoseLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  status: string;
  user_id: string;
  medication_name: string;
  patient_name: string;
}

interface EncouragementMessage {
  id: string;
  patient_user_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  sender_type: string;
  patient_name: string;
}

export function CaregiverNotificationHistoryPage() {
  const { user } = useAuth();

  // Fetch missed doses
  const { data: missedDoses, isLoading: loadingDoses } = useQuery({
    queryKey: ["caregiver-notification-history", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: invitations, error: invError } = await db
        .from("caregiver_invitations")
        .select("patient_user_id, permissions")
        .eq("caregiver_user_id", user.id)
        .eq("status", "accepted");

      if (invError) throw invError;
      if (!invitations || invitations.length === 0) return [];

      const patientIds = invitations
        .filter((inv) => {
          const permissions = inv.permissions as Record<string, boolean> | null;
          return permissions?.view_adherence;
        })
        .map((inv) => inv.patient_user_id);

      if (patientIds.length === 0) return [];

      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [
          p.user_id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Patient",
        ])
      );

      const thirtyDaysAgo = subDays(new Date(), 30);
      const { data: logs, error: logsError } = await db
        .from("medication_logs")
        .select(`
          id,
          medication_id,
          scheduled_time,
          status,
          user_id,
          medications(name)
        `)
        .in("user_id", patientIds)
        .in("status", ["missed", "skipped"])
        .gte("scheduled_time", thirtyDaysAgo.toISOString())
        .order("scheduled_time", { ascending: false });

      if (logsError) throw logsError;

      return (logs || []).map((log) => ({
        id: log.id,
        medication_id: log.medication_id,
        scheduled_time: log.scheduled_time,
        status: log.status,
        user_id: log.user_id,
        medication_name: (log.medications as { name: string } | null)?.name || "Unknown Medication",
        patient_name: profileMap.get(log.user_id) || "Patient",
      })) as MissedDoseLog[];
    },
    enabled: !!user,
  });

  // Fetch encouragement messages sent by the caregiver
  const { data: sentMessages, isLoading: loadingMessages } = useQuery({
    queryKey: ["caregiver-sent-messages-history", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: messages, error } = await db
        .from("caregiver_messages")
        .select("id, patient_user_id, message, created_at, is_read, sender_type")
        .eq("caregiver_user_id", user.id)
        .eq("sender_type", "caregiver")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get unique patient IDs
      const patientIds = [...new Set(messages?.map((m) => m.patient_user_id) || [])];
      
      if (patientIds.length === 0) return [];

      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", patientIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [
          p.user_id,
          `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Patient",
        ])
      );

      return (messages || []).map((msg) => ({
        ...msg,
        patient_name: profileMap.get(msg.patient_user_id) || "Patient",
      })) as EncouragementMessage[];
    },
    enabled: !!user,
  });

  const isLoading = loadingDoses || loadingMessages;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-muted-foreground">
            View missed dose alerts and sent messages
          </p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const groupDosesByDate = (doses: MissedDoseLog[]) => {
    return doses.reduce((acc, dose) => {
      const dateKey = format(new Date(dose.scheduled_time), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(dose);
      return acc;
    }, {} as Record<string, MissedDoseLog[]>);
  };

  const groupMessagesByDate = (messages: EncouragementMessage[]) => {
    return messages.reduce((acc, msg) => {
      const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(msg);
      return acc;
    }, {} as Record<string, EncouragementMessage[]>);
  };

  const groupedDoses = groupDosesByDate(missedDoses || []);
  const groupedMessages = groupMessagesByDate(sentMessages || []);
  const sortedDoseDates = Object.keys(groupedDoses).sort((a, b) => b.localeCompare(a));
  const sortedMessageDates = Object.keys(groupedMessages).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification History</h1>
          <p className="text-muted-foreground">
            View missed dose alerts and sent encouragement messages
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Doses</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {missedDoses?.filter((d) => d.status === "missed").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skipped Doses</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {missedDoses?.filter((d) => d.status === "skipped").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Heart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {sentMessages?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Encouragements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Patients</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set([
                ...(missedDoses?.map((d) => d.user_id) || []),
                ...(sentMessages?.map((m) => m.patient_user_id) || []),
              ]).size || 0}
            </div>
            <p className="text-xs text-muted-foreground">With activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Missed Dose Alerts
            {(missedDoses?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {missedDoses?.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Sent Messages
            {(sentMessages?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {sentMessages?.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Missed Dose Alerts Tab */}
        <TabsContent value="alerts" className="mt-6">
          {sortedDoseDates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Missed Doses</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Great news! None of your patients have missed any doses in the last 30 days.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sortedDoseDates.map((dateKey) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">
                      {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {groupedDoses[dateKey].length} alert{groupedDoses[dateKey].length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="space-y-2 ml-6">
                    {groupedDoses[dateKey].map((dose) => (
                      <Card key={dose.id} className="overflow-hidden">
                        <div className="flex items-center gap-4 p-4">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              dose.status === "missed"
                                ? "bg-destructive/10"
                                : "bg-amber-500/10"
                            }`}
                          >
                            {dose.status === "missed" ? (
                              <XCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{dose.patient_name}</p>
                              <Badge
                                variant={dose.status === "missed" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {dose.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Pill className="h-3.5 w-3.5" />
                                {dose.medication_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {format(new Date(dose.scheduled_time), "h:mm a")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sent Messages Tab */}
        <TabsContent value="messages" className="mt-6">
          {sortedMessageDates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Heart className="h-12 w-12 mx-auto text-primary/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Messages Sent</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You haven't sent any encouragement messages yet. Send supportive messages to your patients from the caregiver dashboard!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sortedMessageDates.map((dateKey) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">
                      {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {groupedMessages[dateKey].length} message{groupedMessages[dateKey].length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <div className="space-y-2 ml-6">
                    {groupedMessages[dateKey].map((msg) => (
                      <Card key={msg.id} className="overflow-hidden">
                        <div className="flex items-start gap-4 p-4">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                            <Heart className="h-5 w-5 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">To: {msg.patient_name}</p>
                              {msg.is_read && (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Read
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {msg.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(msg.created_at), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
