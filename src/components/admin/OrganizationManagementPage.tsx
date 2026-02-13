import { useState, useRef, useEffect, useCallback } from "react";
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
import {
  listOrganizations,
  listOrganizationMembersByUser,
  createOrganization,
  addOrganizationMember,
  upsertOrganizationBranding,
  updateOrganization,
  deleteOrganization,
  updateProfile,
  uploadOrganizationLogo,
} from "@/integrations/azure/data";
import { toast } from "sonner";
import { OrganizationBillingTab } from "./OrganizationBillingTab";
import { useSearchParams } from "react-router-dom";
import type { Organization } from "@/contexts/OrganizationContext";
import { isMultiTenant } from "@/lib/environment";

/** Slug from name: lowercase, replace non-alphanumeric with hyphens */
function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminOrganizationSetup({
  onOrganizationSelected,
  isAdmin,
  authLoading = false,
}: {
  onOrganizationSelected: () => Promise<void>;
  isAdmin: boolean;
  authLoading?: boolean;
}) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [myMemberOrgIds, setMyMemberOrgIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [switchSubmitting, setSwitchSubmitting] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    contact_email: "",
    status: "active" as const,
  });
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", description: "", contact_email: "", status: "active" as const });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [linkAllSubmitting, setLinkAllSubmitting] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [orgsList, membersList] = await Promise.all([
        listOrganizations(),
        listOrganizationMembersByUser(user.id),
      ]);
      const orgs = (orgsList as Organization[]).sort((a, b) => a.name.localeCompare(b.name));
      const activeMembers = (membersList as { organization_id: string }[]).filter((m) => (m as { is_active?: boolean }).is_active !== false);
      setOrganizations(orgs);
      setMyMemberOrgIds(new Set(activeMembers.map((m) => m.organization_id)));
    } catch (e) {
      console.error(e);
      toast.error("Failed to load organizations");
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAdmin || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchOrganizations().finally(() => setLoading(false));
  }, [isAdmin, user?.id, fetchOrganizations]);

  const handleCreateOrganization = async () => {
    if (!user?.id || !createForm.name.trim()) return;
    const slug = createForm.slug.trim() || slugFromName(createForm.name);
    if (!slug) {
      toast.error("Name or slug is required");
      return;
    }
    setCreateSubmitting(true);
    try {
      const org = await createOrganization({
        name: createForm.name.trim(),
        slug,
        description: createForm.description.trim() || null,
        contact_email: createForm.contact_email.trim() || null,
        status: createForm.status,
      });
      const orgId = (org as { id: string }).id;
      if (!orgId) throw new Error("Organization not created");

      await addOrganizationMember({
        organization_id: orgId,
        user_id: user.id,
        org_role: "owner",
        is_active: true,
      });
      await upsertOrganizationBranding({
        organization_id: orgId,
        app_name: createForm.name.trim(),
      });

      toast.success("Organization created. You are set as owner.");
      setIsCreateOpen(false);
      setCreateForm({ name: "", slug: "", description: "", contact_email: "", status: "active" });
      await onOrganizationSelected();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to create organization";
      toast.error(msg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleUseOrganization = async (org: Organization) => {
    if (!user?.id) return;
    setSwitchSubmitting(org.id);
    try {
      const isMember = myMemberOrgIds.has(org.id);
      if (!isMember) {
        await addOrganizationMember({
          organization_id: org.id,
          user_id: user.id,
          org_role: "owner",
          is_active: true,
        });
      }
      await updateProfile(user.id, { organization_id: org.id });
      toast.success(`Switched to ${org.name}`);
      await onOrganizationSelected();
    } catch (e) {
      toast.error("Failed to switch organization");
    } finally {
      setSwitchSubmitting(null);
    }
  };

  const openEdit = (org: Organization) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      slug: org.slug,
      description: org.description || "",
      contact_email: org.contact_email || "",
      status: org.status,
    });
  };

  const handleEditOrganization = async () => {
    if (!editOrg) return;
    setEditSubmitting(true);
    try {
      await updateOrganization(editOrg.id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim(),
        description: editForm.description.trim() || null,
        contact_email: editForm.contact_email.trim() || null,
        status: editForm.status,
      });
      toast.success("Organization updated");
      setEditOrg(null);
      await fetchOrganizations();
    } catch (e) {
      toast.error("Failed to update organization");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!deleteOrg) return;
    setDeleteSubmitting(true);
    try {
      await deleteOrganization(deleteOrg.id);
      toast.success("Organization deleted");
      setDeleteOrg(null);
      await fetchOrganizations();
    } catch (e) {
      toast.error("Failed to delete organization");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleLinkToAllOrganizations = async () => {
    if (!user?.id) return;
    const toLink = organizations.filter((org) => !myMemberOrgIds.has(org.id));
    if (toLink.length === 0) {
      toast.info("You are already linked to all organizations");
      return;
    }
    setLinkAllSubmitting(true);
    try {
      for (const org of toLink) {
        await addOrganizationMember({
          organization_id: org.id,
          user_id: user.id,
          org_role: "owner",
          is_active: true,
        });
      }
      toast.success(`Added you as owner to ${toLink.length} organization(s)`);
      await fetchOrganizations();
    } catch (e) {
      toast.error("Failed to link to some organizations");
    } finally {
      setLinkAllSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">Loading…</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    if (isMultiTenant()) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Organization</h1>
              <p className="text-muted-foreground">Your current organization</p>
            </div>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No organization assigned</h3>
              <p className="text-muted-foreground">
                You are not assigned to an organization yet. Contact your platform administrator to be added to an organization.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">No organization configured</p>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Organization Management</h1>
            <p className="text-muted-foreground">
              Set up or switch organizations (platform admin)
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create organisation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Create a new organization, edit or delete existing ones, or switch to an organization. You can link yourself as owner to any org.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">
              No organizations yet. Create one to get started.
            </p>
          ) : (
            <>
              {organizations.some((org) => !myMemberOrgIds.has(org.id)) && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLinkToAllOrganizations}
                    disabled={linkAllSubmitting}
                  >
                    {linkAllSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Link me to all organizations as owner
                  </Button>
                </div>
              )}
              <ul className="space-y-3">
                {organizations.map((org) => (
                  <li key={org.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {org.slug} · {org.status}
                        {org.contact_email ? ` · ${org.contact_email}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUseOrganization(org)}
                        disabled={switchSubmitting !== null}
                      >
                        {switchSubmitting === org.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : myMemberOrgIds.has(org.id) ? (
                          "Switch to"
                        ) : (
                          "Add me as owner & switch"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(org)}
                        title="Edit organization"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteOrg(org)}
                        title="Delete organization"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editOrg} onOpenChange={(open) => !open && setEditOrg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
            <DialogDescription>Update organization details.</DialogDescription>
          </DialogHeader>
          {editOrg && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Organization name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  value={editForm.slug}
                  onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="url-slug"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description (optional)</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Contact email (optional)</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.contact_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, contact_email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as "active" | "suspended" | "trial" | "cancelled" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditOrganization} disabled={editSubmitting || !editForm.name.trim() || !editForm.slug.trim()}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOrg} onOpenChange={(open) => !open && setDeleteOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete organization</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteOrg?.name}&quot;? This will remove the organization and all its members and branding. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create organisation</DialogTitle>
            <DialogDescription>
              Add a new organisation. You will be set as owner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: f.slug || slugFromName(e.target.value),
                  }))
                }
                placeholder="e.g. Acme Clinic"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-slug">Slug (optional)</Label>
              <Input
                id="create-slug"
                value={createForm.slug}
                onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="e.g. acme-clinic"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-description">Description (optional)</Label>
              <Textarea
                id="create-description"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-email">Contact email (optional)</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.contact_email}
                onChange={(e) => setCreateForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="admin@acme.example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrganization} disabled={createSubmitting || !createForm.name.trim()}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OrganizationManagementPage() {
  const { organization, branding, isOrgAdmin, updateBranding, refreshOrganization } = useOrganization();
  const { members, isLoading: membersLoading, updateMemberRole, removeMember, refetchMembers } = useOrganizationMembers();
  const { isManager, isAdmin, user, loading: authLoading } = useAuth();
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
      <AdminOrganizationSetup
        onOrganizationSelected={refreshOrganization}
        isAdmin={!!isAdmin}
        authLoading={authLoading}
      />
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
      await updateOrganization(organization.id, orgForm);
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
      const logoUrl = await uploadOrganizationLogo(organization.id, file);
      if (logoUrl) {
        await upsertOrganizationBranding({ organization_id: organization.id, logo_url: logoUrl });
      }
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
                    await updateProfile(selectedMember.user_id, {
                      first_name: editFirstName,
                      last_name: editLastName,
                    });
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
