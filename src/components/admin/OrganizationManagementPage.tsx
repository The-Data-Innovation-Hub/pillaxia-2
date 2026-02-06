import { useState, useRef, useEffect } from "react";
import { Building2, Palette, Users, Settings, Plus, Upload, Save, Loader2, Pencil, Trash2, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationMembers, type OrganizationMemberWithProfile } from "@/hooks/useOrganizationMembers";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/integrations/db";
import { getStorageClient } from "@/lib/storage-client";
import { toast } from "sonner";
import { OrganizationBillingTab } from "./OrganizationBillingTab";
import { useSearchParams } from "react-router-dom";

export function OrganizationManagementPage() {
  const { organization, branding, isOrgAdmin, updateBranding, refreshOrganization } = useOrganization();
  const { members, isLoading: membersLoading, updateMemberRole, removeMember, refetchMembers } = useOrganizationMembers();
  const { isManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Managers can also edit organization data
  const canEdit = isOrgAdmin || isManager;
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Member edit dialog state
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberWithProfile | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState<"owner" | "admin" | "member">("member");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Handle billing success/cancel redirects
  const defaultTab = searchParams.get("tab") || "details";
  const billingStatus = searchParams.get("billing");
  
  useEffect(() => {
    if (billingStatus === "success") {
      toast.success("Subscription activated successfully!");
      setSearchParams({ tab: "billing" });
    } else if (billingStatus === "canceled") {
      toast.info("Checkout was canceled");
      setSearchParams({ tab: "billing" });
    }
  }, [billingStatus, setSearchParams]);
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

  // Sync form state when branding data changes from context
  useEffect(() => {
    if (branding) {
      setBrandingForm({
        app_name: branding.app_name || "Pillaxia",
        primary_color: branding.primary_color || "244 69% 31%",
        secondary_color: branding.secondary_color || "280 100% 70%",
        accent_color: branding.accent_color || "174 72% 40%",
        support_email: branding.support_email || "",
        support_phone: branding.support_phone || "",
        terms_url: branding.terms_url || "",
        privacy_url: branding.privacy_url || "",
      });
    }
  }, [branding]);

  // Sync form state when organization data changes from context
  useEffect(() => {
    if (organization) {
      setOrgForm({
        name: organization.name || "",
        description: organization.description || "",
        contact_email: organization.contact_email || "",
        contact_phone: organization.contact_phone || "",
        address: organization.address || "",
        city: organization.city || "",
        state: organization.state || "",
      });
    }
  }, [organization]);

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
      const { error } = await db
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !organization) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${organization.id}/logo-${Date.now()}.${fileExt}`;

      // Upload to avatars bucket (reusing existing bucket)
      const { error: uploadError } = await getStorageClient()
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = getStorageClient()
        .from('avatars')
        .getPublicUrl(fileName);

      // Update organization branding with new logo URL
      const { error: updateError } = await db
        .from('organization_branding')
        .update({ logo_url: publicUrl })
        .eq('organization_id', organization.id);

      if (updateError) throw updateError;

      await refreshOrganization();
      toast.success("Logo uploaded successfully");
    } catch (error) {
      console.error("Logo upload error:", error);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
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

      <Tabs defaultValue={defaultTab} className="w-full">
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
          <TabsTrigger value="billing" className="px-6">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
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
                    <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                      {branding?.logo_url ? (
                        <img src={branding.logo_url} alt="Logo" className="h-full w-full object-contain" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={!canEdit || isUploadingLogo}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={!canEdit || isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {isUploadingLogo ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploadingLogo ? "Uploading..." : "Upload Logo"}
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
                    <div 
                      key={member.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        canEdit ? "cursor-pointer hover:bg-muted/50" : ""
                      }`}
                      onClick={() => {
                        if (canEdit) {
                          setSelectedMember(member);
                          setEditRole(member.org_role);
                          setEditFirstName(member.profile?.first_name || "");
                          setEditLastName(member.profile?.last_name || "");
                          setIsEditDialogOpen(true);
                        }
                      }}
                    >
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
                        {!member.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                        {canEdit && (
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <OrganizationBillingTab />
        </TabsContent>
      </Tabs>

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update the role or remove this member from the organization.
            </DialogDescription>
          </DialogHeader>
          
          {selectedMember && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedMember.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {editFirstName?.charAt(0) || "U"}
                    {editLastName?.charAt(0) || ""}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm text-muted-foreground">
                  {selectedMember.profile?.email || selectedMember.user_id}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First Name</Label>
                  <Input
                    id="edit-first-name"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last Name</Label>
                  <Input
                    id="edit-last-name"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    placeholder="Last name"
                  />
                </div>
              </div>

              {selectedMember.org_role !== "owner" && (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editRole} onValueChange={(value) => setEditRole(value as "admin" | "member")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Admins can manage organization settings and members.
                  </p>
                </div>
              )}

              {selectedMember.org_role === "owner" && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  The owner role cannot be changed. Transfer ownership from organization settings if needed.
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p>Joined: {selectedMember.joined_at ? new Date(selectedMember.joined_at).toLocaleDateString() : "N/A"}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedMember?.org_role !== "owner" && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setIsRemoveDialogOpen(true);
                }}
                className="sm:mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Member
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedMember) return;
                setIsSavingMember(true);
                try {
                  // Update profile name if changed
                  const nameChanged = 
                    editFirstName !== (selectedMember.profile?.first_name || "") ||
                    editLastName !== (selectedMember.profile?.last_name || "");
                  
                  if (nameChanged) {
                    const { error: profileError } = await db
                      .from("profiles")
                      .update({ 
                        first_name: editFirstName, 
                        last_name: editLastName 
                      })
                      .eq("user_id", selectedMember.user_id);
                    
                    if (profileError) throw profileError;
                  }

                  // Update role if changed (and not owner)
                  if (selectedMember.org_role !== "owner" && editRole !== selectedMember.org_role) {
                    await updateMemberRole.mutateAsync({ 
                      memberId: selectedMember.id, 
                      newRole: editRole 
                    });
                  } else if (nameChanged) {
                    refetchMembers();
                    toast.success("Member updated");
                  }
                  
                  setIsEditDialogOpen(false);
                } catch (error) {
                  console.error("Failed to update member:", error);
                  toast.error("Failed to update member");
                } finally {
                  setIsSavingMember(false);
                }
              }}
              disabled={isSavingMember || updateMemberRole.isPending}
            >
              {(isSavingMember || updateMemberRole.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium">
                {selectedMember?.profile?.first_name} {selectedMember?.profile?.last_name}
              </span>{" "}
              from the organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedMember) {
                  removeMember.mutate(selectedMember.id);
                }
                setIsRemoveDialogOpen(false);
                setSelectedMember(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
