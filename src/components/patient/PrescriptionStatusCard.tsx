import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, Send, Package, CheckCircle, XCircle } from "lucide-react";

type PrescriptionStatus = "pending" | "sent" | "ready" | "picked_up" | "completed" | "cancelled";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  dosage_unit: string;
  prescription_status: string;
  pharmacy: string | null;
  updated_at: string;
}

const statusConfig: Record<PrescriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  sent: { label: "Sent to Pharmacy", variant: "default", icon: Send },
  ready: { label: "Ready for Pickup", variant: "default", icon: Package },
  picked_up: { label: "Picked Up", variant: "outline", icon: CheckCircle },
  completed: { label: "Completed", variant: "outline", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

export function PrescriptionStatusCard() {
  const { user } = useAuth();

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ["patient-prescriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("medications")
        .select("id, name, dosage, dosage_unit, prescription_status, pharmacy, updated_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data as Medication[];
    },
    enabled: !!user,
  });

  // Filter to show only prescriptions with meaningful status (not just pending default)
  const activePrescriptions = prescriptions?.filter(
    (p) => p.prescription_status !== "completed" && p.prescription_status !== "cancelled"
  ) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prescription Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activePrescriptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Prescription Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No active prescriptions to track.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Prescription Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activePrescriptions.map((prescription) => {
          const status = (prescription.prescription_status as PrescriptionStatus) || "pending";
          const config = statusConfig[status] || statusConfig.pending;
          const StatusIcon = config.icon;

          return (
            <div
              key={prescription.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <StatusIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{prescription.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {prescription.dosage} {prescription.dosage_unit}
                    {prescription.pharmacy && ` • ${prescription.pharmacy}`}
                  </p>
                </div>
              </div>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
