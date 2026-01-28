import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserPlus, Mail, Clock, Check, X, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const emailSchema = z.string().email("Please enter a valid email address");

interface CaregiverPermissions {
  view_medications?: boolean;
  view_adherence?: boolean;
  view_symptoms?: boolean;
}

interface CaregiverInvitation {
  id: string;
  caregiver_email: string;
  caregiver_user_id: string | null;
  status: string;
  permissions: CaregiverPermissions | null;
  created_at: string;
  updated_at: string;
  caregiver_profile?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function CaregiversPageContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [deleteInvitation, setDeleteInvitation] = useState<CaregiverInvitation | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [permissions, setPermissions] = useState({
    view_medications: true,
    view_adherence: true,
    view_symptoms: false,
  });

  // Fetch caregiver invitations
  const { data: invitations, isLoading } = useQuery({
    queryKey: ["caregiver-invitations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caregiver_invitations")
        .select("*")
        .eq("patient_user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch caregiver profiles for accepted invitations
      const invitationsWithProfiles = await Promise.all(
        (data || []).map(async (inv) => {
          if (inv.caregiver_user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("user_id", inv.caregiver_user_id)
              .maybeSingle();
            return { ...inv, caregiver_profile: profile };
          }
          return { ...inv, caregiver_profile: null };
        })
      );

      return invitationsWithProfiles as unknown as CaregiverInvitation[];
    },
    enabled: !!user,
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: async ({ email, perms }: { email: string; perms: typeof permissions }) => {
      const { error } = await supabase.from("caregiver_invitations").insert({
        patient_user_id: user!.id,
        caregiver_email: email.toLowerCase().trim(),
        permissions: perms,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      setInviteDialogOpen(false);
      setNewEmail("");
      setPermissions({ view_medications: true, view_adherence: true, view_symptoms: false });
      queryClient.invalidateQueries({ queryKey: ["caregiver-invitations"] });
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("An invitation has already been sent to this email");
      } else {
        toast.error("Failed to send invitation");
      }
      console.error("Invitation error:", error);
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("caregiver_invitations")
        .delete()
        .eq("id", invitationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation removed");
      setDeleteInvitation(null);
      queryClient.invalidateQueries({ queryKey: ["caregiver-invitations"] });
    },
    onError: (error) => {
      toast.error("Failed to remove invitation");
      console.error("Delete error:", error);
    },
  });

  const handleSendInvitation = () => {
    const result = emailSchema.safeParse(newEmail);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }
    setEmailError("");
    sendInvitationMutation.mutate({ email: newEmail, perms: permissions });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <Check className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <X className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingInvitations = invitations?.filter((i) => i.status === "pending") || [];
  const activeCaregiversList = invitations?.filter((i) => i.status === "accepted") || [];
  const declinedInvitations = invitations?.filter((i) => i.status === "declined") || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Caregiver
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a Caregiver</DialogTitle>
              <DialogDescription>
                Send an invitation to a family member or caregiver to allow them to monitor your medication adherence.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Caregiver's Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="caregiver@example.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setEmailError("");
                  }}
                />
                {emailError && <p className="text-sm text-destructive">{emailError}</p>}
              </div>
              <div className="space-y-3">
                <Label>Permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_medications" className="font-normal">
                      View Medications
                    </Label>
                    <Switch
                      id="view_medications"
                      checked={permissions.view_medications}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({ ...p, view_medications: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_adherence" className="font-normal">
                      View Adherence
                    </Label>
                    <Switch
                      id="view_adherence"
                      checked={permissions.view_adherence}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({ ...p, view_adherence: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="view_symptoms" className="font-normal">
                      View Symptoms
                    </Label>
                    <Switch
                      id="view_symptoms"
                      checked={permissions.view_symptoms}
                      onCheckedChange={(checked) =>
                        setPermissions((p) => ({ ...p, view_symptoms: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSendInvitation}
                disabled={sendInvitationMutation.isPending}
              >
                {sendInvitationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Caregivers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Caregivers
          </CardTitle>
          <CardDescription>
            People who can view your medication information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCaregiversList.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No active caregivers yet. Invite someone to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {activeCaregiversList.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {invitation.caregiver_profile?.first_name?.[0] ||
                          invitation.caregiver_email[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      {invitation.caregiver_profile?.first_name && (
                        <p className="font-medium">
                          {invitation.caregiver_profile.first_name} {invitation.caregiver_profile.last_name || ""}
                        </p>
                      )}
                      <p className={invitation.caregiver_profile?.first_name ? "text-sm text-muted-foreground" : "font-medium"}>
                        {invitation.caregiver_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(invitation.status)}
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {invitation.permissions?.view_medications && (
                        <Badge variant="secondary" className="text-xs">Meds</Badge>
                      )}
                      {invitation.permissions?.view_adherence && (
                        <Badge variant="secondary" className="text-xs">Adherence</Badge>
                      )}
                      {invitation.permissions?.view_symptoms && (
                        <Badge variant="secondary" className="text-xs">Symptoms</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteInvitation(invitation)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Waiting for these people to accept your invitation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{invitation.caregiver_email}</p>
                      <p className="text-sm text-muted-foreground">
                        Sent {new Date(invitation.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(invitation.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteInvitation(invitation)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Declined Invitations */}
      {declinedInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground">Declined Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {declinedInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-lg opacity-60"
                >
                  <span className="text-sm">{invitation.caregiver_email}</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(invitation.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteInvitation(invitation)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteInvitation} onOpenChange={() => setDeleteInvitation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Caregiver Access?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteInvitation?.status === "accepted"
                ? `This will revoke ${deleteInvitation.caregiver_email}'s access to your medication information. They will no longer be able to monitor your adherence.`
                : `This will cancel the invitation to ${deleteInvitation?.caregiver_email}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteInvitation && deleteInvitationMutation.mutate(deleteInvitation.id)}
            >
              {deleteInvitationMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
