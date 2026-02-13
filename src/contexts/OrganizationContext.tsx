import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  getProfileByUserId,
  listOrganizationMembersByUser,
  getOrganization,
  getOrganizationBranding,
  upsertOrganizationBranding,
  updateProfile,
} from "@/integrations/azure/data";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "suspended" | "trial" | "cancelled";
  license_type: string | null;
  max_users: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationBranding {
  id: string;
  organization_id: string;
  app_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  border_radius: string;
  support_email: string | null;
  support_phone: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  email_header_color: string | null;
  email_footer_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  org_role: "owner" | "admin" | "member";
  is_active: boolean;
  joined_at: string | null;
}

/** Minimal org info for switcher (multi-tenant) */
export interface AvailableOrganization {
  id: string;
  name: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  branding: OrganizationBranding | null;
  membership: OrganizationMember | null;
  /** All orgs the user is a member of (for multi-tenant switcher) */
  availableOrganizations: AvailableOrganization[];
  isLoading: boolean;
  error: Error | null;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
  refreshOrganization: () => Promise<void>;
  updateBranding: (updates: Partial<OrganizationBranding>) => Promise<void>;
  /** Switch current organization (multi-tenant); updates profile and refreshes context */
  switchOrganization: (orgId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

// Default branding when no organization is set
const DEFAULT_BRANDING: Omit<OrganizationBranding, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
  app_name: "Pillaxia",
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  primary_color: "244 69% 31%",
  secondary_color: "280 100% 70%",
  accent_color: "174 72% 40%",
  font_family: "Inter, sans-serif",
  border_radius: "0.5rem",
  support_email: null,
  support_phone: null,
  terms_url: null,
  privacy_url: null,
  email_header_color: null,
  email_footer_text: null,
};

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [branding, setBranding] = useState<OrganizationBranding | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<AvailableOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganizationData = useCallback(async () => {
    if (!user?.id) {
      setOrganization(null);
      setBranding(null);
      setMembership(null);
      setAvailableOrganizations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profileData = await getProfileByUserId(user.id);
      const memberDataList = await listOrganizationMembersByUser(user.id);
      const activeMembers = (memberDataList as OrganizationMember[]).filter((m) => m.is_active);
      const sorted = [...activeMembers].sort((a, b) => {
        const aAt = a.joined_at ? new Date(a.joined_at).getTime() : 0;
        const bAt = b.joined_at ? new Date(b.joined_at).getTime() : 0;
        return bAt - aAt;
      });

      if (!sorted.length) {
        setOrganization(null);
        setBranding(null);
        setMembership(null);
        setAvailableOrganizations([]);
        setIsLoading(false);
        return;
      }

      const profileOrgId = (profileData as { organization_id?: string } | null)?.organization_id;
      let memberData = sorted[0];
      if (profileOrgId) {
        const preferred = sorted.find((m) => m.organization_id === profileOrgId);
        if (preferred) memberData = preferred;
      }

      setMembership(memberData);

      const orgData = await getOrganization(memberData.organization_id);
      setOrganization(orgData as Organization);

      const brandingData = await getOrganizationBranding(memberData.organization_id);
      setBranding(brandingData as OrganizationBranding | null);

      const orgs = await Promise.all(
        sorted.map((m) => getOrganization(m.organization_id).then((o) => ({ id: (o as Organization).id, name: (o as Organization).name })))
      );
      setAvailableOrganizations(orgs);
    } catch (err) {
      console.error("Error fetching organization data:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrganizationData();
  }, [fetchOrganizationData]);

  // Apply branding CSS variables when branding changes
  useEffect(() => {
    const root = document.documentElement;
    const activeBranding = branding || DEFAULT_BRANDING;

    // Apply custom properties for theming
    if (activeBranding.primary_color) {
      root.style.setProperty("--org-primary", activeBranding.primary_color);
    }
    if (activeBranding.secondary_color) {
      root.style.setProperty("--org-secondary", activeBranding.secondary_color);
    }
    if (activeBranding.accent_color) {
      root.style.setProperty("--org-accent", activeBranding.accent_color);
    }
    if (activeBranding.border_radius) {
      root.style.setProperty("--org-radius", activeBranding.border_radius);
    }

    // Update favicon if set
    if (branding?.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = branding.favicon_url;
      }
    }

    // Update document title with app name
    if (activeBranding.app_name && activeBranding.app_name !== "Pillaxia") {
      const baseTitle = document.title.replace(/^Pillaxia/, activeBranding.app_name);
      document.title = baseTitle.startsWith(activeBranding.app_name) 
        ? baseTitle 
        : `${activeBranding.app_name}`;
    }
  }, [branding]);

  const updateBranding = useCallback(async (updates: Partial<OrganizationBranding>) => {
    if (!organization?.id) throw new Error("No organization to update");

    await upsertOrganizationBranding({ organization_id: organization.id, ...updates });
    await fetchOrganizationData();
  }, [organization?.id, fetchOrganizationData]);

  const switchOrganization = useCallback(
    async (orgId: string) => {
      if (!user?.id) return;
      await updateProfile(user.id, { organization_id: orgId });
      await fetchOrganizationData();
    },
    [user?.id, fetchOrganizationData]
  );

  const isOrgAdmin = membership?.org_role === "admin" || membership?.org_role === "owner";
  const isOrgOwner = membership?.org_role === "owner";

  const value: OrganizationContextType = {
    organization,
    branding,
    membership,
    availableOrganizations,
    isLoading,
    error,
    isOrgAdmin,
    isOrgOwner,
    refreshOrganization: fetchOrganizationData,
    updateBranding,
    switchOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
