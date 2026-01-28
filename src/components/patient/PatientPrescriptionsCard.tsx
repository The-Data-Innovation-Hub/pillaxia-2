import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText,
  Clock,
  CheckCircle,
  Package,
  AlertTriangle,
  Pill,
  XCircle,
  Send,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import { usePrescriptions, PrescriptionStatus } from "@/hooks/usePrescriptions";
import { format } from "date-fns";

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; description: string }> = {
  draft: { label: "Draft", variant: "outline", icon: <FileText className="h-4 w-4" />, description: "Prescription created but not sent" },
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-4 w-4" />, description: "Awaiting processing" },
  sent: { label: "Sent to Pharmacy", variant: "default", icon: <Send className="h-4 w-4" />, description: "Sent to your pharmacy" },
  received: { label: "Received", variant: "default", icon: <CheckCircle className="h-4 w-4" />, description: "Pharmacy received your prescription" },
  processing: { label: "Being Prepared", variant: "secondary", icon: <Package className="h-4 w-4" />, description: "Pharmacy is preparing your medication" },
  ready: { label: "Ready for Pickup", variant: "default", icon: <CheckCircle className="h-4 w-4" />, description: "Your medication is ready!" },
  dispensed: { label: "Picked Up", variant: "default", icon: <Pill className="h-4 w-4" />, description: "You've received your medication" },
  cancelled: { label: "Cancelled", variant: "destructive", icon: <XCircle className="h-4 w-4" />, description: "This prescription was cancelled" },
  expired: { label: "Expired", variant: "destructive", icon: <AlertTriangle className="h-4 w-4" />, description: "This prescription has expired" },
};

export function PatientPrescriptionsCard() {
  const { prescriptions, isLoading } = usePrescriptions();

  const activePrescriptions = prescriptions?.filter(
    (rx) => !['dispensed', 'cancelled', 'expired'].includes(rx.status)
  );

  const recentPrescriptions = prescriptions?.filter(
    (rx) => ['dispensed', 'cancelled', 'expired'].includes(rx.status)
  ).slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              My Prescriptions
            </CardTitle>
            <CardDescription>
              Track your prescription status and history
            </CardDescription>
          </div>
          {activePrescriptions && activePrescriptions.length > 0 && (
            <Badge variant="secondary">
              {activePrescriptions.length} Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Prescriptions */}
        {activePrescriptions && activePrescriptions.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Active Prescriptions
            </h3>
            {activePrescriptions.map((rx) => {
              const statusConfig = STATUS_CONFIG[rx.status];
              return (
                <div
                  key={rx.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{rx.medication_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {rx.dosage} {rx.dosage_unit} {rx.form}
                      </p>
                    </div>
                    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Status Progress */}
                  <div className="flex items-center gap-1 text-xs">
                    {['sent', 'received', 'processing', 'ready'].map((step, index) => {
                      const stepStatuses = ['sent', 'received', 'processing', 'ready'];
                      const currentIndex = stepStatuses.indexOf(rx.status);
                      const isComplete = currentIndex >= index;
                      const isCurrent = rx.status === step;

                      return (
                        <div key={step} className="flex items-center gap-1 flex-1">
                          <div
                            className={`h-2 flex-1 rounded-full ${
                              isComplete ? 'bg-primary' : 'bg-muted'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {statusConfig.description}
                  </p>

                  {/* Pharmacy Info */}
                  {rx.pharmacy && (
                    <div className="flex items-center gap-4 text-sm pt-2 border-t">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {rx.pharmacy.name}
                      </div>
                      {rx.pharmacy.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {rx.pharmacy.phone}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Refills */}
                  {rx.refills_remaining > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <RefreshCw className="h-3 w-3 text-muted-foreground" />
                      <span>{rx.refills_remaining} refill(s) remaining</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No active prescriptions</p>
          </div>
        )}

        {/* Recent Prescriptions */}
        {recentPrescriptions && recentPrescriptions.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="history">
              <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Recent History ({recentPrescriptions.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {recentPrescriptions.map((rx) => {
                    const statusConfig = STATUS_CONFIG[rx.status];
                    return (
                      <div
                        key={rx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <p className="font-medium text-sm">{rx.medication_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(rx.date_written), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant={statusConfig.variant} className="text-xs">
                          {statusConfig.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
