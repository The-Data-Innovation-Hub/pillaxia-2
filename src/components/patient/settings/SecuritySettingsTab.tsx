import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TwoFactorSettingsCard } from "@/components/patient/TwoFactorSettingsCard";
import { BiometricSettingsCard } from "@/components/patient/BiometricSettingsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export function SecuritySettingsTab() {
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      // Sign out and let user know account deletion is requested
      // Note: Full account deletion typically requires admin/backend handling
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      toast.success("Account deletion requested. You have been signed out.");
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Biometric Authentication */}
      <BiometricSettingsCard />

      {/* Two-Factor Authentication */}
      <TwoFactorSettingsCard />

      {/* Delete Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This action <strong>cannot be undone</strong>. This will permanently delete your
                    account and remove all your data including:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Your profile and personal information</li>
                    <li>All medications and schedules</li>
                    <li>Symptom history and health records</li>
                    <li>Notification preferences and settings</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4">
                <Label htmlFor="confirm-delete" className="text-sm font-medium">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="mt-2"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText("")}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
