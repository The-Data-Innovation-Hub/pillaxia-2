import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, AlertTriangle, Clock, XCircle } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";

interface ExpiringDrug {
  id: string;
  name: string;
  strength: string;
  form: string;
  expiry_date: string;
  current_stock: number;
  lot_number: string | null;
}

export function ExpiryTrackingCard() {
  const { data: expiringDrugs, isLoading } = useQuery({
    queryKey: ["expiring-controlled-drugs"],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await db
        .from("controlled_drugs")
        .select("id, name, strength, form, expiry_date, current_stock, lot_number")
        .eq("is_active", true)
        .not("expiry_date", "is", null)
        .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0])
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      return data as ExpiringDrug[];
    },
  });

  const getExpiryStatus = (expiryDate: string) => {
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) return { label: "Expired", variant: "destructive" as const, icon: XCircle };
    if (days <= 7) return { label: `${days}d left`, variant: "destructive" as const, icon: AlertTriangle };
    return { label: `${days}d left`, variant: "secondary" as const, icon: Clock };
  };

  const expiredCount = expiringDrugs?.filter(d => differenceInDays(parseISO(d.expiry_date), new Date()) < 0).length || 0;
  const criticalCount = expiringDrugs?.filter(d => {
    const days = differenceInDays(parseISO(d.expiry_date), new Date());
    return days >= 0 && days <= 7;
  }).length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-600" />
            Expiry Tracking
          </CardTitle>
          {(expiredCount > 0 || criticalCount > 0) && (
            <Badge variant="destructive">
              {expiredCount > 0 ? `${expiredCount} Expired` : `${criticalCount} Critical`}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !expiringDrugs?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No medications expiring within 30 days
          </p>
        ) : (
          <div className="space-y-3">
            {expiredCount > 0 && (
              <Alert variant="destructive" className="mb-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Expired Medications</AlertTitle>
                <AlertDescription>
                  {expiredCount} medication(s) have expired and should be removed from inventory.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expiringDrugs.map((drug) => {
                const status = getExpiryStatus(drug.expiry_date);
                const StatusIcon = status.icon;
                
                return (
                  <div
                    key={drug.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{drug.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {drug.strength} • {drug.form}
                        {drug.lot_number && ` • Lot: ${drug.lot_number}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {drug.current_stock} units
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2">
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(drug.expiry_date), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
