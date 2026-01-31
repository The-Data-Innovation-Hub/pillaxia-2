import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, isBefore, startOfToday, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Clock, MapPin, User, Check, X, Video, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface Appointment {
  id: string;
  clinician_user_id: string;
  patient_user_id: string;
  title: string;
  description: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: string;
  location: string | null;
  is_video_call?: boolean;
  video_room_id?: string | null;
  clinician?: {
    first_name: string | null;
    last_name: string | null;
  };
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-muted text-muted-foreground border-muted",
  completed: "bg-primary/10 text-primary border-primary/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

export function AppointmentsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, formatDate } = useLanguage();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["patient-appointments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_user_id", user!.id)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;

      // Fetch clinician profiles
      const clinicianIds = [...new Set(data.map((a) => a.clinician_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", clinicianIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      return data.map((appointment) => ({
        ...appointment,
        clinician: profileMap.get(appointment.clinician_user_id),
      })) as Appointment[];
    },
    enabled: !!user,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["patient-appointments"] });
      toast.success(
        status === "confirmed"
          ? t.appointments.confirmed
          : t.appointments.cancelled
      );
    },
    onError: () => {
      toast.error(t.appointments.updateFailed);
    },
  });

  const today = startOfToday();
  const upcomingAppointments = appointments?.filter(
    (a) =>
      !isBefore(parseISO(a.appointment_date), today) &&
      a.status !== "cancelled" &&
      a.status !== "completed"
  ) || [];

  const canJoinVideoCall = (appointment: Appointment) => {
    if (!appointment.is_video_call) return false;
    if (appointment.status === "cancelled" || appointment.status === "completed") return false;
    // Allow joining on the day of the appointment when confirmed
    return isToday(parseISO(appointment.appointment_date)) && 
           (appointment.status === "confirmed" || appointment.status === "scheduled");
  };

  const handleJoinVideoCall = (appointment: Appointment) => {
    navigate(`/dashboard/telemedicine/room/${appointment.id}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t.appointments.upcoming}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t.appointments.upcoming}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{t.appointments.noUpcoming}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingAppointments.slice(0, 3).map((appointment) => (
              <div
                key={appointment.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{appointment.title}</h4>
                    {appointment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {appointment.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={statusColors[appointment.status]}
                  >
                    {appointment.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(parseISO(appointment.appointment_date), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {appointment.appointment_time.slice(0, 5)} (
                    {appointment.duration_minutes}{t.common.min})
                  </div>
                  {appointment.clinician && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Dr. {appointment.clinician.first_name}{" "}
                      {appointment.clinician.last_name}
                    </div>
                  )}
                  {appointment.is_video_call ? (
                    <div className="flex items-center gap-1.5 text-primary">
                      <Video className="h-4 w-4" />
                      {t.appointments.videoCall}
                    </div>
                  ) : appointment.location ? (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {appointment.location}
                    </div>
                  ) : null}
                </div>

                {canJoinVideoCall(appointment) && (
                  <Button
                    size="sm"
                    onClick={() => handleJoinVideoCall(appointment)}
                    className="gap-1 w-full sm:w-auto"
                  >
                    <MonitorPlay className="h-4 w-4" />
                    {t.appointments.joinVideoCall}
                  </Button>
                )}

                {appointment.status === "scheduled" && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: appointment.id,
                          status: "confirmed",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t.common.confirm}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateStatusMutation.mutate({
                          id: appointment.id,
                          status: "cancelled",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t.common.cancel}
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {upcomingAppointments.length > 3 && (
              <p className="text-sm text-center text-muted-foreground">
                +{upcomingAppointments.length - 3} {t.appointments.moreAppointments}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
