import { useState, forwardRef } from "react";
import { Building2, Palette, Users, Settings, Plus, Upload, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const OrganizationManagementPage = forwardRef<HTMLDivElement>((_, ref) => {
  const { organization, branding, isOrgAdmin, updateBranding, refreshOrganization } = useOrganization();
  const { members, isLoading: membersLoading, updateMemberRole, removeMember } = useOrganizationMembers();
  const { isManager } = useAuth();
  
  // Managers can also edit organization data
  const canEdit = isOrgAdmin || isManager;
  
  const [isSaving, setIsSaving] = useState(false);
  const [brandingForm, setBrandingForm] = useState({
    app_name: branding?.app_name || "Pillaxia",
    primary_color: branding?.primary_color || "244 69% 31%",
    secondary_color: branding?.secondary_color || "280 100% 70%",
    accent_color: branding?.accent_color || "174 72% 40%",
    support_email: branding?.support_email || "",
    support_phone: branding?.support_phone || "",
    terms_url: branding?.terms_url || "",
    privacy_url: branding?.privacy_url || "",
  });
  
  const [orgForm, setOrgForm] = useState({
    name: organization?.name || "",
    description: organization?.description || "",
    contact_email: organization?.contact_email || "",
    contact_phone: organization?.contact_phone || "",
    address: organization?.address || "",
    city: organization?.city || "",
    state: organization?.state || "",
  });

  if (!organization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">
              No organization configured
            </p>
          </div>
        </div>
        
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Set Up</h3>
            <p className="text-muted-foreground mb-4">
              This platform is running in single-tenant mode. Contact a platform administrator to set up multi-tenancy.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveBranding = async () => {
    setIsSaving(true);
    try {
      await updateBranding(brandingForm);
      toast.success("Branding updated successfully");
    } catch (error) {
      toast.error("Failed to update branding");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrganization = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update(orgForm)
        .eq("id", organization.id);
      
      if (error) throw error;
      await refreshOrganization();
      toast.success("Organization details updated");
    } catch (error) {
      toast.error("Failed to update organization");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-500";
      case "trial": return "bg-yellow-500/10 text-yellow-500";
      case "suspended": return "bg-red-500/10 text-red-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">
              Manage your organization settings and branding
            </p>
          </div>
        </div>
        <Badge className={getStatusColor(organization.status)}>
          {organization.status}
        </Badge>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="details" className="px-6">
            <Settings className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="branding" className="px-6">
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="members" className="px-6">
            <Users className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Basic information about your healthcare organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={organization.slug} disabled />
                  <p className="text-xs text-muted-foreground">URL identifier cannot be changed</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-description">Description</Label>
                <Textarea
                  id="org-description"
                  value={orgForm.description}
                  onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                  disabled={!canEdit}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-email">Contact Email</Label>
                  <Input
                    id="org-email"
                    type="email"
                    value={orgForm.contact_email}
                    onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-phone">Contact Phone</Label>
                  <Input
                    id="org-phone"
                    value={orgForm.contact_phone}
                    onChange={(e) => setOrgForm({ ...orgForm, contact_phone: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-address">Address</Label>
                <Input
                  id="org-address"
                  value={orgForm.address}
                  onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="org-city">City</Label>
                  <Input
                    id="org-city"
                    value={orgForm.city}
                    onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-state">State</Label>
                  <Input
                    id="org-state"
                    value={orgForm.state}
                    onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {canEdit && (
                <div className="pt-4">
                  <Button onClick={handleSaveOrganization} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>License Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">License Type</p>
                  <p className="font-medium capitalize">{organization.license_type || "Standard"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Users</p>
                  <p className="font-medium">{organization.max_users || "Unlimited"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Members</p>
                  <p className="font-medium">{members.filter(m => m.is_active).length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(organization.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>White-Label Branding</CardTitle>
              <CardDescription>
                Customize the appearance of the platform for your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="app-name">Application Name</Label>
                  <Input
                    id="app-name"
                    value={brandingForm.app_name}
                    onChange={(e) => setBrandingForm({ ...brandingForm, app_name: e.target.value })}
                    placeholder="Your App Name"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-muted-foreground">
                    This name will appear in the header and page titles
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center">
                      {branding?.logo_url ? (
                        <img src={branding.logo_url} alt="Logo" className="h-12 w-12 object-contain" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <Button variant="outline" size="sm" disabled={!canEdit}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Color Scheme</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Primary Color (HSL)</Label>
                    <div className="flex gap-2">
                      <div 
                        className="h-10 w-10 rounded border" 
                        style={{ backgroundColor: `hsl(${brandingForm.primary_color})` }}
                      />
                      <Input
                        value={brandingForm.primary_color}
                        onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                        placeholder="244 69% 31%"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Secondary Color (HSL)</Label>
                    <div className="flex gap-2">
                      <div 
                        className="h-10 w-10 rounded border" 
                        style={{ backgroundColor: `hsl(${brandingForm.secondary_color})` }}
                      />
                      <Input
                        value={brandingForm.secondary_color}
                        onChange={(e) => setBrandingForm({ ...brandingForm, secondary_color: e.target.value })}
                        placeholder="280 100% 70%"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Accent Color (HSL)</Label>
                    <div className="flex gap-2">
                      <div 
                        className="h-10 w-10 rounded border" 
                        style={{ backgroundColor: `hsl(${brandingForm.accent_color})` }}
                      />
                      <Input
                        value={brandingForm.accent_color}
                        onChange={(e) => setBrandingForm({ ...brandingForm, accent_color: e.target.value })}
                        placeholder="174 72% 40%"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="support-email">Support Email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={brandingForm.support_email}
                    onChange={(e) => setBrandingForm({ ...brandingForm, support_email: e.target.value })}
                    placeholder="support@yourorg.com"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-phone">Support Phone</Label>
                  <Input
                    id="support-phone"
                    value={brandingForm.support_phone}
                    onChange={(e) => setBrandingForm({ ...brandingForm, support_phone: e.target.value })}
                    placeholder="+234 xxx xxx xxxx"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="terms-url">Terms of Service URL</Label>
                  <Input
                    id="terms-url"
                    type="url"
                    value={brandingForm.terms_url}
                    onChange={(e) => setBrandingForm({ ...brandingForm, terms_url: e.target.value })}
                    placeholder="https://yourorg.com/terms"
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacy-url">Privacy Policy URL</Label>
                  <Input
                    id="privacy-url"
                    type="url"
                    value={brandingForm.privacy_url}
                    onChange={(e) => setBrandingForm({ ...brandingForm, privacy_url: e.target.value })}
                    placeholder="https://yourorg.com/privacy"
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {canEdit && (
                <div className="pt-4">
                  <Button onClick={handleSaveBranding} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Branding
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>See how your branding will look</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-6 space-y-4">
                <div className="flex items-center gap-3">
                  {branding?.logo_url ? (
                    <img src={branding.logo_url} alt="Logo" className="h-8 w-8 object-contain" />
                  ) : (
                    <div 
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: `hsl(${brandingForm.primary_color})` }}
                    >
                      {brandingForm.app_name.charAt(0)}
                    </div>
                  )}
                  <span className="font-semibold">{brandingForm.app_name}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    style={{ backgroundColor: `hsl(${brandingForm.primary_color})` }}
                  >
                    Primary Button
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    style={{ borderColor: `hsl(${brandingForm.secondary_color})`, color: `hsl(${brandingForm.secondary_color})` }}
                  >
                    Secondary Button
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organization Members</CardTitle>
                  <CardDescription>
                    Manage users who belong to your organization
                  </CardDescription>
                </div>
                {isOrgAdmin && (
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {member.profile?.first_name?.charAt(0) || "U"}
                            {member.profile?.last_name?.charAt(0) || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.profile?.first_name || ""} {member.profile?.last_name || ""}
                            {!member.profile?.first_name && !member.profile?.last_name && "Unknown User"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.profile?.email || member.user_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={member.org_role === "owner" ? "default" : "secondary"}>
                          {member.org_role}
                        </Badge>
                        {isOrgAdmin && member.org_role !== "owner" && (
                          <Select
                            value={member.org_role}
                            onValueChange={(value) => updateMemberRole.mutate({ 
                              memberId: member.id, 
                              newRole: value as "admin" | "member" 
                            })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {!member.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
});

OrganizationManagementPage.displayName = "OrganizationManagementPage";
