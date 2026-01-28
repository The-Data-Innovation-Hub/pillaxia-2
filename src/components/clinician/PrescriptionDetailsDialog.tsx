import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  User,
  Pill,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
  Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Prescription, PrescriptionStatus } from "@/hooks/usePrescriptions";

interface PrescriptionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: Prescription;
}

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-500" },
  pending: { label: "Pending", color: "bg-yellow-500" },
  sent: { label: "Sent", color: "bg-blue-500" },
  received: { label: "Received", color: "bg-indigo-500" },
  processing: { label: "Processing", color: "bg-purple-500" },
  ready: { label: "Ready for Pickup", color: "bg-green-500" },
  dispensed: { label: "Dispensed", color: "bg-green-600" },
  cancelled: { label: "Cancelled", color: "bg-red-500" },
  expired: { label: "Expired", color: "bg-red-400" },
};

export function PrescriptionDetailsDialog({
  open,
  onOpenChange,
  prescription,
}: PrescriptionDetailsDialogProps) {
  const { data: statusHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["prescription-history", prescription.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_status_history")
        .select(`
          *,
          changed_by_profile:profiles!prescription_status_history_changed_by_fkey(first_name, last_name)
        `)
        .eq("prescription_id", prescription.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const statusConfig = STATUS_CONFIG[prescription.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <DialogTitle>Prescription Details</DialogTitle>
          </div>
          <DialogDescription>
            Rx #{prescription.prescription_number}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Status and Key Info */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${statusConfig.color} text-white`}>
                {statusConfig.label}
              </Badge>
              {prescription.is_controlled_substance && (
                <Badge variant="destructive">
                  Schedule {prescription.dea_schedule}
                </Badge>
              )}
              {prescription.dispense_as_written && (
                <Badge variant="outline">DAW</Badge>
              )}
            </div>

            {/* Medication Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Medication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">
                    {prescription.medication_name}
                  </div>
                  {prescription.generic_name && (
                    <div className="text-sm text-muted-foreground">
                      ({prescription.generic_name})
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Dosage</div>
                    <div className="font-medium">
                      {prescription.dosage} {prescription.dosage_unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Form</div>
                    <div className="font-medium capitalize">{prescription.form}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Quantity</div>
                    <div className="font-medium">{prescription.quantity}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Refills</div>
                    <div className="font-medium">
                      {prescription.refills_remaining} / {prescription.refills_authorized}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-muted-foreground text-sm mb-1">Directions (Sig)</div>
                  <div className="bg-muted p-3 rounded-md">{prescription.sig}</div>
                </div>

                {prescription.instructions && (
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">
                      Additional Instructions
                    </div>
                    <div>{prescription.instructions}</div>
                  </div>
                )}

                {prescription.diagnosis_code && (
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">Diagnosis</div>
                    <div>
                      {prescription.diagnosis_code}
                      {prescription.diagnosis_description &&
                        ` - ${prescription.diagnosis_description}`}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Patient Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium">
                  {prescription.patient_profile?.first_name}{" "}
                  {prescription.patient_profile?.last_name}
                </div>
                {prescription.patient_profile?.email && (
                  <div className="text-sm text-muted-foreground">
                    {prescription.patient_profile.email}
                  </div>
                )}
                {prescription.patient_profile?.phone && (
                  <div className="text-sm text-muted-foreground">
                    {prescription.patient_profile.phone}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pharmacy Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Pharmacy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {prescription.pharmacy ? (
                  <div>
                    <div className="font-medium">{prescription.pharmacy.name}</div>
                    {prescription.pharmacy.phone && (
                      <div className="text-sm text-muted-foreground">
                        {prescription.pharmacy.phone}
                      </div>
                    )}
                    {prescription.pharmacy.email && (
                      <div className="text-sm text-muted-foreground">
                        {prescription.pharmacy.email}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No pharmacy selected</div>
                )}
              </CardContent>
            </Card>

            {/* Timeline/History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Key dates */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Written</div>
                      <div className="font-medium">
                        {format(new Date(prescription.date_written), "MMM d, yyyy")}
                      </div>
                    </div>
                    {prescription.date_expires && (
                      <div>
                        <div className="text-muted-foreground">Expires</div>
                        <div className="font-medium">
                          {format(new Date(prescription.date_expires), "MMM d, yyyy")}
                        </div>
                      </div>
                    )}
                    {prescription.sent_at && (
                      <div>
                        <div className="text-muted-foreground">Sent</div>
                        <div className="font-medium">
                          {format(new Date(prescription.sent_at), "MMM d, yyyy h:mm a")}
                        </div>
                      </div>
                    )}
                    {prescription.dispensed_at && (
                      <div>
                        <div className="text-muted-foreground">Dispensed</div>
                        <div className="font-medium">
                          {format(new Date(prescription.dispensed_at), "MMM d, yyyy h:mm a")}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Status History */}
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Status Changes
                  </div>
                  {historyLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : statusHistory && statusHistory.length > 0 ? (
                    <div className="space-y-3">
                      {statusHistory.map((entry: any) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="mt-0.5">
                            {entry.new_status === "cancelled" ? (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            ) : entry.new_status === "sent" ? (
                              <Send className="h-4 w-4 text-primary" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {STATUS_CONFIG[entry.new_status as PrescriptionStatus]?.label ||
                                  entry.new_status}
                              </span>
                              <span className="text-muted-foreground">←</span>
                              <span className="text-muted-foreground">
                                {STATUS_CONFIG[entry.previous_status as PrescriptionStatus]
                                  ?.label || entry.previous_status}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              {format(
                                new Date(entry.created_at),
                                "MMM d, yyyy h:mm a"
                              )}
                              {entry.changed_by_profile && (
                                <span>
                                  {" "}
                                  by {entry.changed_by_profile.first_name}{" "}
                                  {entry.changed_by_profile.last_name}
                                </span>
                              )}
                            </div>
                            {entry.notes && (
                              <div className="mt-1 text-muted-foreground italic">
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No status changes recorded
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
