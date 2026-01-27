import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, isBefore, startOfToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Calendar, Clock, MoreVertical, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateAppointmentDialog } from "./CreateAppointmentDialog";

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
  created_at: string;
  patient?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-muted text-muted-foreground border-muted",
  completed: "bg-primary/10 text-primary border-primary/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
};

export function AppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["clinician-appointments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("clinician_user_id", user!.id)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;

      // Fetch patient profiles
      const patientIds = [...new Set(data.map((a) => a.patient_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", patientIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      return data.map((appointment) => ({
        ...appointment,
        patient: profileMap.get(appointment.patient_user_id),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinician-appointments"] });
      toast.success("Appointment updated");
    },
    onError: () => {
      toast.error("Failed to update appointment");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinician-appointments"] });
      toast.success("Appointment deleted");
    },
    onError: () => {
      toast.error("Failed to delete appointment");
    },
  });

  const today = startOfToday();
  const upcomingAppointments = appointments?.filter(
    (a) => !isBefore(parseISO(a.appointment_date), today) && a.status !== "cancelled"
  ) || [];
  const pastAppointments = appointments?.filter(
    (a) => isBefore(parseISO(a.appointment_date), today) || a.status === "cancelled"
  ) || [];

  const renderAppointmentRow = (appointment: Appointment) => (
    <TableRow key={appointment.id}>
      <TableCell>
        <div className="font-medium">{appointment.title}</div>
        {appointment.description && (
          <div className="text-sm text-muted-foreground line-clamp-1">
            {appointment.description}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">
            {appointment.patient?.first_name} {appointment.patient?.last_name}
          </span>
          <span className="text-sm text-muted-foreground">
            {appointment.patient?.email}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {format(parseISO(appointment.appointment_date), "MMM d, yyyy")}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {appointment.appointment_time.slice(0, 5)} ({appointment.duration_minutes}min)
        </div>
      </TableCell>
      <TableCell>
        {appointment.location || <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusColors[appointment.status]}>
          {appointment.status}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {appointment.status === "scheduled" && (
              <DropdownMenuItem
                onClick={() =>
                  updateStatusMutation.mutate({ id: appointment.id, status: "confirmed" })
                }
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Confirmed
              </DropdownMenuItem>
            )}
            {(appointment.status === "scheduled" || appointment.status === "confirmed") && (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    updateStatusMutation.mutate({ id: appointment.id, status: "completed" })
                  }
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Completed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    updateStatusMutation.mutate({ id: appointment.id, status: "no_show" })
                  }
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Mark No-Show
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    updateStatusMutation.mutate({ id: appointment.id, status: "cancelled" })
                  }
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => deleteMutation.mutate(appointment.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">
            Schedule and manage patient follow-up appointments
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="upcoming">
                Upcoming ({upcomingAppointments.length})
              </TabsTrigger>
              <TabsTrigger value="past">
                Past ({pastAppointments.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Tabs value={activeTab}>
              <TabsContent value="upcoming" className="mt-0">
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No upcoming appointments</p>
                    <Button
                      variant="link"
                      onClick={() => setIsCreateOpen(true)}
                      className="mt-2"
                    >
                      Schedule your first appointment
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingAppointments.map(renderAppointmentRow)}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="past" className="mt-0">
                {pastAppointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No past appointments</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pastAppointments.map(renderAppointmentRow)}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <CreateAppointmentDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
