import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, Bell, Plus, Trash2, Loader2, Calendar } from "lucide-react";

interface MedicationSchedule {
  id: string;
  medication_id: string;
  time_of_day: string;
  quantity: number;
  days_of_week: number[] | null;
  is_active: boolean;
  with_food: boolean | null;
  medication: {
    id: string;
    name: string;
    dosage: string;
    dosage_unit: string;
  };
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function NotificationSchedulingCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingSchedule, setEditingSchedule] = useState<MedicationSchedule | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    medication_id: "",
    time_of_day: "08:00",
    quantity: 1,
    days_of_week: [0, 1, 2, 3, 4, 5, 6] as number[],
    with_food: false,
  });

  // Fetch medications
  const { data: medications, isLoading: medsLoading } = useQuery({
    queryKey: ["medications-list", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("medications")
        .select("id, name, dosage, dosage_unit")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["medication-schedules", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("medication_schedules")
        .select(`
          id,
          medication_id,
          time_of_day,
          quantity,
          days_of_week,
          is_active,
          with_food,
          medications!inner(id, name, dosage, dosage_unit, user_id)
        `)
        .eq("medications.user_id", user!.id)
        .order("time_of_day");
      if (error) throw error;
      return data.map(s => ({
        ...s,
        medication: s.medications as unknown as MedicationSchedule["medication"],
      })) as MedicationSchedule[];
    },
    enabled: !!user,
  });

  // Add schedule mutation
  const addMutation = useMutation({
    mutationFn: async (schedule: typeof newSchedule) => {
      const { error } = await db.from("medication_schedules").insert({
        medication_id: schedule.medication_id,
        time_of_day: schedule.time_of_day,
        quantity: schedule.quantity,
        days_of_week: schedule.days_of_week,
        with_food: schedule.with_food,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-schedules"] });
      toast.success("Schedule added");
      setIsAddDialogOpen(false);
      setNewSchedule({
        medication_id: "",
        time_of_day: "08:00",
        quantity: 1,
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        with_food: false,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to add schedule", { description: error.message });
    },
  });

  // Update schedule mutation
  const updateMutation = useMutation({
    mutationFn: async (schedule: MedicationSchedule) => {
      const { error } = await db
        .from("medication_schedules")
        .update({
          time_of_day: schedule.time_of_day,
          quantity: schedule.quantity,
          days_of_week: schedule.days_of_week,
          is_active: schedule.is_active,
          with_food: schedule.with_food,
        })
        .eq("id", schedule.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-schedules"] });
      toast.success("Schedule updated");
      setEditingSchedule(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update schedule", { description: error.message });
    },
  });

  // Delete schedule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("medication_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-schedules"] });
      toast.success("Schedule deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete schedule", { description: error.message });
    },
  });

  const toggleDay = (day: number, currentDays: number[]) => {
    if (currentDays.includes(day)) {
      return currentDays.filter(d => d !== day);
    }
    return [...currentDays, day].sort();
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (isLoading || medsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Notification Schedule
            </CardTitle>
            <CardDescription>
              Customize when you receive medication reminders
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)} disabled={!medications?.length}>
            <Plus className="h-4 w-4 mr-1" />
            Add Schedule
          </Button>
        </CardHeader>
        <CardContent>
          {!schedules?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No scheduled reminders yet</p>
              <p className="text-sm">Add a medication first, then set up reminders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    schedule.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{schedule.medication.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {schedule.medication.dosage} {schedule.medication.dosage_unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(schedule.time_of_day)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {schedule.days_of_week?.length === 7
                            ? "Every day"
                            : schedule.days_of_week?.map(d => DAYS_OF_WEEK[d].label).join(", ")}
                        </span>
                        {schedule.with_food && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            With food
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={(checked) => {
                          updateMutation.mutate({ ...schedule, is_active: checked });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingSchedule(schedule)}
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Schedule Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reminder Schedule</DialogTitle>
            <DialogDescription>
              Set a custom time and days for medication reminders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Medication</Label>
              <Select
                value={newSchedule.medication_id}
                onValueChange={(v) => setNewSchedule({ ...newSchedule, medication_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select medication" />
                </SelectTrigger>
                <SelectContent>
                  {medications?.map((med) => (
                    <SelectItem key={med.id} value={med.id}>
                      {med.name} - {med.dosage} {med.dosage_unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={newSchedule.time_of_day}
                  onChange={(e) => setNewSchedule({ ...newSchedule, time_of_day: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={newSchedule.quantity}
                  onChange={(e) => setNewSchedule({ ...newSchedule, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days</Label>
              <div className="flex gap-1 flex-wrap">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    size="sm"
                    variant={newSchedule.days_of_week.includes(day.value) ? "default" : "outline"}
                    className="w-10 h-8 p-0"
                    onClick={() => {
                      setNewSchedule({
                        ...newSchedule,
                        days_of_week: toggleDay(day.value, newSchedule.days_of_week),
                      });
                    }}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="with-food"
                checked={newSchedule.with_food}
                onCheckedChange={(c) => setNewSchedule({ ...newSchedule, with_food: c })}
              />
              <Label htmlFor="with-food">Take with food</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate(newSchedule)}
              disabled={!newSchedule.medication_id || addMutation.isPending}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Dialog */}
      {editingSchedule && (
        <Dialog open={!!editingSchedule} onOpenChange={() => setEditingSchedule(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
              <DialogDescription>
                Update reminder time for {editingSchedule.medication.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={editingSchedule.time_of_day.slice(0, 5)}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, time_of_day: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingSchedule.quantity}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex gap-1 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={(editingSchedule.days_of_week || []).includes(day.value) ? "default" : "outline"}
                      className="w-10 h-8 p-0"
                      onClick={() => {
                        setEditingSchedule({
                          ...editingSchedule,
                          days_of_week: toggleDay(day.value, editingSchedule.days_of_week || []),
                        });
                      }}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="edit-with-food"
                  checked={editingSchedule.with_food || false}
                  onCheckedChange={(c) => setEditingSchedule({ ...editingSchedule, with_food: c })}
                />
                <Label htmlFor="edit-with-food">Take with food</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSchedule(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate(editingSchedule)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
