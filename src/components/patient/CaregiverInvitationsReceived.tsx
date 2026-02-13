import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCaregiverInvitations,
  getProfileByUserId,
  updateCaregiverInvitation,
} from "@/integrations/azure/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Heart, Pill, Activity, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface CaregiverPermissions {
  view_medications?: boolean;
  view_adherence?: boolean;
  view_symptoms?: boolean;
}

interface ReceivedInvitation {
  id: string;
  patient_user_id: string;
  caregiver_email: string;
  status: string;
  permissions: CaregiverPermissions | null;
  created_at: string;
  patient_profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export function CaregiverInvitationsReceived() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch invitations where the current user's email matches
  const { data: invitations, isLoading } = useQuery({
    queryKey: ["received-invitations", user?.id, profile?.email],
    queryFn: async () => {
      if (!profile?.email) return [];

      const data = await listCaregiverInvitations({
        caregiver_email: profile.email.toLowerCase(),
      });
      const filtered = (data || []).filter((inv) =>
        ["pending", "accepted"].includes((inv.status as string) || "")
      );
      const sorted = filtered.sort(
        (a, b) =>
          new Date((b.created_at as string) || 0).getTime() -
          new Date((a.created_at as string) || 0).getTime()
      );
      const invitationsWithProfiles = await Promise.all(
        sorted.map(async (inv) => {
          const patientProfile = await getProfileByUserId(inv.patient_user_id as string);
          const pp = patientProfile as { first_name?: string; last_name?: string; email?: string } | null;
          return {
            ...inv,
            patient_profile: pp
              ? { first_name: pp.first_name ?? null, last_name: pp.last_name ?? null, email: pp.email ?? null }
              : null,
          };
        })
      );
      return invitationsWithProfiles as unknown as ReceivedInvitation[];
    },
    enabled: !!user && !!profile?.email,
  });

  const acceptMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await updateCaregiverInvitation(invitationId, {
        status: "accepted",
        caregiver_user_id: user!.id,
      });
    },
    onSuccess: () => {
      toast.success("You are now a caregiver for this patient");
      queryClient.invalidateQueries({ queryKey: ["received-invitations"] });
    },
    onError: (error) => {
      toast.error("Failed to accept invitation");
      console.error("Accept error:", error);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      await updateCaregiverInvitation(invitationId, { status: "declined" });
    },
    onSuccess: () => {
      toast.info("Invitation declined");
      queryClient.invalidateQueries({ queryKey: ["received-invitations"] });
    },
    onError: (error) => {
      toast.error("Failed to decline invitation");
      console.error("Decline error:", error);
    },
  });

  const pendingInvitations = invitations?.filter((i) => i.status === "pending") || [];
  const acceptedInvitations = invitations?.filter((i) => i.status === "accepted") || [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Caregiver Invitations
            </CardTitle>
            <CardDescription>
              Someone has invited you to be their caregiver
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="p-4 border rounded-lg bg-background"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {invitation.patient_profile?.first_name
                        ? `${invitation.patient_profile.first_name} ${invitation.patient_profile.last_name || ""}`
                        : "A patient"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      wants you to monitor their medication adherence
                    </p>
                    <div className="flex gap-2 mt-2">
                      {invitation.permissions?.view_medications && (
                        <Badge variant="secondary" className="text-xs">
                          <Pill className="h-3 w-3 mr-1" />
                          Medications
                        </Badge>
                      )}
                      {invitation.permissions?.view_adherence && (
                        <Badge variant="secondary" className="text-xs">
                          <Activity className="h-3 w-3 mr-1" />
                          Adherence
                        </Badge>
                      )}
                      {invitation.permissions?.view_symptoms && (
                        <Badge variant="secondary" className="text-xs">
                          <ClipboardList className="h-3 w-3 mr-1" />
                          Symptoms
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => declineMutation.mutate(invitation.id)}
                      disabled={declineMutation.isPending}
                    >
                      {declineMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => acceptMutation.mutate(invitation.id)}
                      disabled={acceptMutation.isPending}
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Patients I'm caring for */}
      {acceptedInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              People You're Caring For
            </CardTitle>
            <CardDescription>
              You can view medication information for these patients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {acceptedInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium">
                      {invitation.patient_profile?.first_name?.[0] || "P"}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">
                      {invitation.patient_profile?.first_name
                        ? `${invitation.patient_profile.first_name} ${invitation.patient_profile.last_name || ""}`
                        : "Patient"}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {invitation.permissions?.view_medications && (
                        <Badge variant="outline" className="text-xs">Meds</Badge>
                      )}
                      {invitation.permissions?.view_adherence && (
                        <Badge variant="outline" className="text-xs">Adherence</Badge>
                      )}
                      {invitation.permissions?.view_symptoms && (
                        <Badge variant="outline" className="text-xs">Symptoms</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  Active
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
