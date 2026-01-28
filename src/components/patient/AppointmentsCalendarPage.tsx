import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Check,
  X,
  Video,
  MonitorPlay,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  scheduled: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground border-muted",
  completed: "bg-primary/10 text-primary border-primary/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusDotColors: Record<string, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-green-500",
  cancelled: "bg-muted-foreground",
  completed: "bg-primary",
  no_show: "bg-destructive",
};

export function AppointmentsCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["patient-appointments-calendar", user?.id, currentMonth],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_user_id", user!.id)
        .gte("appointment_date", format(monthStart, "yyyy-MM-dd"))
        .lte("appointment_date", format(monthEnd, "yyyy-MM-dd"))
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
      queryClient.invalidateQueries({ queryKey: ["patient-appointments-calendar"] });
      toast.success(
        status === "confirmed" ? "Appointment confirmed" : "Appointment cancelled"
      );
    },
    onError: () => {
      toast.error("Failed to update appointment");
    },
  });

  const selectedDateAppointments = appointments?.filter((a) =>
    isSameDay(parseISO(a.appointment_date), selectedDate)
  ) || [];

  const appointmentDates = appointments?.map((a) => parseISO(a.appointment_date)) || [];

  const canJoinVideoCall = (appointment: Appointment) => {
    if (!appointment.is_video_call) return false;
    if (appointment.status === "cancelled" || appointment.status === "completed") return false;
    return isSameDay(parseISO(appointment.appointment_date), new Date()) &&
           (appointment.status === "confirmed" || appointment.status === "scheduled");
  };

  const handleJoinVideoCall = (appointment: Appointment) => {
    navigate(`/dashboard/telemedicine/room/${appointment.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-muted-foreground">
          View and manage your upcoming appointments
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Calendar Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              onMonthChange={setCurrentMonth}
              className="rounded-md border pointer-events-auto"
              modifiers={{
                hasAppointment: appointmentDates,
              }}
              modifiersClassNames={{
                hasAppointment: "relative",
              }}
              components={{
                DayContent: ({ date }) => {
                  const hasAppointments = appointmentDates.some((d) =>
                    isSameDay(d, date)
                  );
                  const dayAppointments = appointments?.filter((a) =>
                    isSameDay(parseISO(a.appointment_date), date)
                  ) || [];

                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {date.getDate()}
                      {hasAppointments && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {dayAppointments.slice(0, 3).map((apt, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                statusDotColors[apt.status] || "bg-primary"
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                },
              }}
            />

            {/* Legend */}
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Status Legend</p>
            <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent-foreground/60" />
                  <span>Scheduled</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-chart-2" />
                  <span>Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>Completed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : selectedDateAppointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No appointments</p>
                <p className="text-sm">No appointments scheduled for this date</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {selectedDateAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h4 className="font-semibold">{appointment.title}</h4>
                          {appointment.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {appointment.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0", statusColors[appointment.status])}
                        >
                          {appointment.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {appointment.appointment_time.slice(0, 5)} ({appointment.duration_minutes} min)
                        </div>
                        {appointment.clinician && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />
                            Dr. {appointment.clinician.first_name} {appointment.clinician.last_name}
                          </div>
                        )}
                        {appointment.is_video_call ? (
                          <div className="flex items-center gap-1.5 text-primary">
                            <Video className="h-4 w-4" />
                            Video Call
                          </div>
                        ) : appointment.location ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {appointment.location}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-4 w-4" />
                            In-Person
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {canJoinVideoCall(appointment) && (
                          <Button
                            size="sm"
                            onClick={() => handleJoinVideoCall(appointment)}
                            className="gap-1"
                          >
                            <MonitorPlay className="h-4 w-4" />
                            Join Video Call
                          </Button>
                        )}

                        {appointment.status === "scheduled" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: appointment.id,
                                  status: "confirmed",
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                              className="gap-1"
                            >
                              <Check className="h-4 w-4" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: appointment.id,
                                  status: "cancelled",
                                })
                              }
                              disabled={updateStatusMutation.isPending}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
