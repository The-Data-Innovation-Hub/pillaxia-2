/**
 * Select Role page – shown when a new user has no role assigned.
 * Lets the user choose their role (patient, clinician, pharmacist, manager)
 * and saves it to user_roles and ensures a profile exists.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { db } from "@/integrations/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User, Stethoscope, Pill, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";

type AppRole = Database["public"]["Enums"]["app_role"];

const SELF_SERVICE_ROLE_KEYS: { value: AppRole; labelKey: keyof typeof import("@/i18n/translations/en").en.auth; icon: React.ElementType }[] = [
  { value: "patient", labelKey: "rolePatient", icon: User },
  { value: "clinician", labelKey: "roleClinician", icon: Stethoscope },
  { value: "pharmacist", labelKey: "rolePharmacist", icon: Pill },
  { value: "manager", labelKey: "roleManager", icon: Building2 },
];

export default function SelectRolePage() {
  const { t } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRole) return;
    setSaving(true);
    try {
      // Ensure profile exists (upsert so we don't fail if already created)
      const { error: profileError } = await db
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            first_name: profile?.first_name ?? "New",
            last_name: profile?.last_name ?? "User",
            language_preference: "en",
            timezone: "UTC",
          },
          { onConflict: "user_id" }
        )
        .select();
      if (profileError) {
        console.error("Profile upsert error:", profileError);
        toast.error("Could not save profile. Please try again.");
        setSaving(false);
        return;
      }

      const { error: roleError } = await db.from("user_roles").insert({
        user_id: user.id,
        role: selectedRole as AppRole,
      });

      if (roleError) {
        console.error("Role insert error:", roleError);
        toast.error("Could not save role. Please try again.");
        setSaving(false);
        return;
      }

      toast.success("Role saved. Loading your dashboard…");
      await refreshProfile();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pillaxia-navy-light/10 via-background to-pillaxia-purple/10 p-4">
      <Card className="w-full max-w-md shadow-pillaxia-card border-pillaxia-cyan/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 text-3xl font-bold text-pillaxia-cyan">Pillaxia</div>
          <CardTitle className="text-xl">Choose your role</CardTitle>
          <CardDescription>
            Select how you will use the platform. You can be assigned additional roles later by an
            administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">{t.auth.selectRole}</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as AppRole)}
                required
              >
                <SelectTrigger id="role" className="w-full">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {SELF_SERVICE_ROLE_KEYS.map(({ value, labelKey, icon: Icon }) => (
                    <SelectItem key={value} value={value} className="gap-2">
                      <Icon className="h-4 w-4 opacity-70" />
                      {t.auth[labelKey]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-pillaxia-navy-dark"
              disabled={saving || !selectedRole}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
