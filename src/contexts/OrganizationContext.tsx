import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

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

interface OrganizationContextType {
  organization: Organization | null;
  branding: OrganizationBranding | null;
  membership: OrganizationMember | null;
  isLoading: boolean;
  error: Error | null;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
  refreshOrganization: () => Promise<void>;
  updateBranding: (updates: Partial<OrganizationBranding>) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganizationData = useCallback(async () => {
    if (!user?.id) {
      setOrganization(null);
      setBranding(null);
      setMembership(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First, get the user's organization membership
      const { data: memberData, error: memberError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!memberData) {
        // User is not part of any organization
        setOrganization(null);
        setBranding(null);
        setMembership(null);
        setIsLoading(false);
        return;
      }

      setMembership(memberData as OrganizationMember);

      // Fetch organization details
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", memberData.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData as Organization);

      // Fetch branding
      const { data: brandingData, error: brandingError } = await supabase
        .from("organization_branding")
        .select("*")
        .eq("organization_id", memberData.organization_id)
        .maybeSingle();

      if (brandingError) throw brandingError;
      setBranding(brandingData as OrganizationBranding | null);
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

    const { error } = await supabase
      .from("organization_branding")
      .upsert({
        organization_id: organization.id,
        ...updates,
      }, { onConflict: 'organization_id' });

    if (error) throw error;

    // Refresh branding
    await fetchOrganizationData();
  }, [organization?.id, fetchOrganizationData]);

  const isOrgAdmin = membership?.org_role === "admin" || membership?.org_role === "owner";
  const isOrgOwner = membership?.org_role === "owner";

  const value: OrganizationContextType = {
    organization,
    branding,
    membership,
    isLoading,
    error,
    isOrgAdmin,
    isOrgOwner,
    refreshOrganization: fetchOrganizationData,
    updateBranding,
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
