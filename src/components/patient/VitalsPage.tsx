import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Heart, Thermometer, Activity, Droplets, Scale, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface VitalRecord {
  id: string;
  user_id: string;
  recorded_at: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  blood_glucose: number | null;
  notes: string | null;
  is_fasting: boolean;
  measurement_location: string | null;
  created_at: string;
}

export default function VitalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<"bp" | "hr" | "glucose" | "weight">("bp");
  
  const [formData, setFormData] = useState({
    blood_pressure_systolic: "",
    blood_pressure_diastolic: "",
    heart_rate: "",
    temperature: "",
    respiratory_rate: "",
    oxygen_saturation: "",
    weight: "",
    height: "",
    blood_glucose: "",
    notes: "",
    is_fasting: false,
    measurement_location: "left_arm",
  });

  const { data: vitals, isLoading } = useQuery({
    queryKey: ["patient-vitals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_vitals")
        .select("*")
        .eq("user_id", user?.id)
        .order("recorded_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as VitalRecord[];
    },
    enabled: !!user?.id,
  });

  const addVitalMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const height = data.height ? parseFloat(data.height) : null;
      const weight = data.weight ? parseFloat(data.weight) : null;
      const bmi = height && weight ? parseFloat((weight / ((height / 100) ** 2)).toFixed(1)) : null;

      const { error } = await supabase.from("patient_vitals").insert({
        user_id: user?.id,
        blood_pressure_systolic: data.blood_pressure_systolic ? parseInt(data.blood_pressure_systolic) : null,
        blood_pressure_diastolic: data.blood_pressure_diastolic ? parseInt(data.blood_pressure_diastolic) : null,
        heart_rate: data.heart_rate ? parseInt(data.heart_rate) : null,
        temperature: data.temperature ? parseFloat(data.temperature) : null,
        respiratory_rate: data.respiratory_rate ? parseInt(data.respiratory_rate) : null,
        oxygen_saturation: data.oxygen_saturation ? parseInt(data.oxygen_saturation) : null,
        weight,
        height,
        bmi,
        blood_glucose: data.blood_glucose ? parseFloat(data.blood_glucose) : null,
        notes: data.notes || null,
        is_fasting: data.is_fasting,
        measurement_location: data.measurement_location,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vitals recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["patient-vitals"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Failed to record vitals");
    },
  });

  const resetForm = () => {
    setFormData({
      blood_pressure_systolic: "",
      blood_pressure_diastolic: "",
      heart_rate: "",
      temperature: "",
      respiratory_rate: "",
      oxygen_saturation: "",
      weight: "",
      height: "",
      blood_glucose: "",
      notes: "",
      is_fasting: false,
      measurement_location: "left_arm",
    });
  };

  const getLatestVital = (key: keyof VitalRecord) => {
    if (!vitals?.length) return null;
    const record = vitals.find((v) => v[key] !== null);
    return record ? record[key] : null;
  };

  const getBPStatus = (systolic: number | null, diastolic: number | null) => {
    if (!systolic || !diastolic) return null;
    if (systolic >= 180 || diastolic >= 120) return { label: "Crisis", color: "destructive" };
    if (systolic >= 140 || diastolic >= 90) return { label: "High", color: "destructive" };
    if (systolic >= 130 || diastolic >= 80) return { label: "Elevated", color: "warning" };
    if (systolic < 90 || diastolic < 60) return { label: "Low", color: "warning" };
    return { label: "Normal", color: "success" };
  };

  const getChartData = () => {
    if (!vitals?.length) return [];
    return vitals
      .slice(0, 30)
      .reverse()
      .map((v) => ({
        date: format(new Date(v.recorded_at), "MMM d"),
        systolic: v.blood_pressure_systolic,
        diastolic: v.blood_pressure_diastolic,
        heartRate: v.heart_rate,
        glucose: v.blood_glucose,
        weight: v.weight,
      }));
  };

  const latestBP = {
    systolic: getLatestVital("blood_pressure_systolic") as number | null,
    diastolic: getLatestVital("blood_pressure_diastolic") as number | null,
  };
  const bpStatus = getBPStatus(latestBP.systolic, latestBP.diastolic);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vitals Tracking</h1>
          <p className="text-muted-foreground">Monitor your health measurements over time</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Record Vitals
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record New Vitals</DialogTitle>
              <DialogDescription>Enter your current health measurements</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Blood Pressure (Systolic)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="120"
                    value={formData.blood_pressure_systolic}
                    onChange={(e) => setFormData({ ...formData, blood_pressure_systolic: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">mmHg</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure (Diastolic)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="80"
                    value={formData.blood_pressure_diastolic}
                    onChange={(e) => setFormData({ ...formData, blood_pressure_diastolic: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">mmHg</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Heart Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="72"
                    value={formData.heart_rate}
                    onChange={(e) => setFormData({ ...formData, heart_rate: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">bpm</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="36.5"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">°C</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Oxygen Saturation (SpO2)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="98"
                    value={formData.oxygen_saturation}
                    onChange={(e) => setFormData({ ...formData, oxygen_saturation: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Respiratory Rate</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="16"
                    value={formData.respiratory_rate}
                    onChange={(e) => setFormData({ ...formData, respiratory_rate: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">/min</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Weight</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="70"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">kg</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Height</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="170"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">cm</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Blood Glucose</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="100"
                    value={formData.blood_glucose}
                    onChange={(e) => setFormData({ ...formData, blood_glucose: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">mg/dL</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Measurement Location</Label>
                <Select
                  value={formData.measurement_location}
                  onValueChange={(value) => setFormData({ ...formData, measurement_location: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left_arm">Left Arm</SelectItem>
                    <SelectItem value="right_arm">Right Arm</SelectItem>
                    <SelectItem value="wrist">Wrist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center space-x-2">
                <Switch
                  id="fasting"
                  checked={formData.is_fasting}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_fasting: checked })}
                />
                <Label htmlFor="fasting">Fasting reading (for glucose)</Label>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => addVitalMutation.mutate(formData)} disabled={addVitalMutation.isPending}>
                {addVitalMutation.isPending ? "Saving..." : "Save Vitals"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Pressure</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestBP.systolic && latestBP.diastolic
                ? `${latestBP.systolic}/${latestBP.diastolic}`
                : "No data"}
            </div>
            {bpStatus && (
              <Badge variant={bpStatus.color === "success" ? "default" : bpStatus.color === "warning" ? "secondary" : "destructive"}>
                {bpStatus.label}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heart Rate</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getLatestVital("heart_rate") ? `${getLatestVital("heart_rate")} bpm` : "No data"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blood Glucose</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getLatestVital("blood_glucose") ? `${getLatestVital("blood_glucose")} mg/dL` : "No data"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weight</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getLatestVital("weight") ? `${getLatestVital("weight")} kg` : "No data"}
            </div>
            {getLatestVital("bmi") && (
              <p className="text-xs text-muted-foreground">BMI: {getLatestVital("bmi")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vitals Trends</CardTitle>
              <CardDescription>Track your measurements over time</CardDescription>
            </div>
            <Select value={selectedChart} onValueChange={(v) => setSelectedChart(v as typeof selectedChart)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bp">Blood Pressure</SelectItem>
                <SelectItem value="hr">Heart Rate</SelectItem>
                <SelectItem value="glucose">Blood Glucose</SelectItem>
                <SelectItem value="weight">Weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedChart === "bp" && (
                  <>
                    <Line type="monotone" dataKey="systolic" stroke="hsl(var(--primary))" name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="hsl(var(--secondary))" name="Diastolic" />
                  </>
                )}
                {selectedChart === "hr" && (
                  <Line type="monotone" dataKey="heartRate" stroke="hsl(var(--destructive))" name="Heart Rate" />
                )}
                {selectedChart === "glucose" && (
                  <Line type="monotone" dataKey="glucose" stroke="hsl(var(--accent))" name="Glucose" />
                )}
                {selectedChart === "weight" && (
                  <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" name="Weight" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Records */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Readings</CardTitle>
          <CardDescription>Your most recent vital sign measurements</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !vitals?.length ? (
            <p className="text-muted-foreground">No vitals recorded yet. Start tracking your health!</p>
          ) : (
            <div className="space-y-4">
              {vitals.slice(0, 10).map((vital) => (
                <div key={vital.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {format(new Date(vital.recorded_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {vital.blood_pressure_systolic && vital.blood_pressure_diastolic && (
                        <span>BP: {vital.blood_pressure_systolic}/{vital.blood_pressure_diastolic}</span>
                      )}
                      {vital.heart_rate && <span>HR: {vital.heart_rate} bpm</span>}
                      {vital.oxygen_saturation && <span>SpO2: {vital.oxygen_saturation}%</span>}
                      {vital.temperature && <span>Temp: {vital.temperature}°C</span>}
                      {vital.blood_glucose && <span>Glucose: {vital.blood_glucose} mg/dL</span>}
                      {vital.weight && <span>Weight: {vital.weight} kg</span>}
                    </div>
                  </div>
                  {vital.notes && (
                    <p className="text-xs text-muted-foreground max-w-xs truncate">{vital.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
