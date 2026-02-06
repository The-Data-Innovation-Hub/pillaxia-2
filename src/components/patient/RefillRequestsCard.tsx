import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface RefillRequest {
  id: string;
  status: string;
  patient_notes: string | null;
  pharmacist_notes: string | null;
  refills_granted: number | null;
  created_at: string;
  resolved_at: string | null;
  medications: {
    name: string;
    dosage: string;
    dosage_unit: string;
  } | null;
}

export function RefillRequestsCard() {
  const { user } = useAuth();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["patient-refill-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("refill_requests")
        .select(`
          id,
          status,
          patient_notes,
          pharmacist_notes,
          refills_granted,
          created_at,
          resolved_at,
          medications (name, dosage, dosage_unit)
        `)
        .eq("patient_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as RefillRequest[];
    },
    enabled: !!user?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "denied":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700 gap-1">
            <XCircle className="h-3 w-3" />
            Denied
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="h-5 w-5" />
            Refill Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="h-5 w-5" />
          Recent Refill Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {request.medications?.name || "Unknown Medication"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.medications?.dosage} {request.medications?.dosage_unit}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested {format(new Date(request.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                {getStatusBadge(request.status)}
              </div>
              {request.status === "approved" && request.refills_granted && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {request.refills_granted} refill{request.refills_granted > 1 ? "s" : ""} granted
                </p>
              )}
              {request.status === "denied" && request.pharmacist_notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  "{request.pharmacist_notes}"
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
