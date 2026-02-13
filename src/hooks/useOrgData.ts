/**
 * Hook for fetching and managing organization data.
 * Uses Azure API (see integrations/azure/data).
 */
import { useState, useCallback } from "react";
import {
  getProfileByUserId,
  listOrganizationMembersByUser,
  getOrganization,
  getOrganizationBranding,
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

interface OrgDataState {
  organization: Organization | null;
  branding: OrganizationBranding | null;
  membership: OrganizationMember | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches organization data for a user.
 * Handles profile preferences, memberships, org details, and branding.
 */
export async function fetchOrganizationData(
  userId: string
): Promise<Omit<OrgDataState, "isLoading">> {
  try {
    const profileData = await getProfileByUserId(userId);
    const memberDataList = await listOrganizationMembersByUser(userId);
    const activeMembers = (memberDataList as OrganizationMember[]).filter((m) => m.is_active);
    const sorted = [...activeMembers].sort((a, b) => {
      const aAt = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const bAt = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return bAt - aAt;
    });

    if (!sorted.length) {
      return { organization: null, branding: null, membership: null, error: null };
    }

    const profileOrgId = (profileData as { organization_id?: string } | null)?.organization_id;
    let memberData = sorted[0];
    if (profileOrgId) {
      const preferred = sorted.find((m) => m.organization_id === profileOrgId);
      if (preferred) memberData = preferred;
    }

    const orgData = await getOrganization(memberData.organization_id);
    const brandingData = await getOrganizationBranding(memberData.organization_id);

    return {
      organization: orgData as Organization,
      branding: brandingData as OrganizationBranding | null,
      membership: memberData,
      error: null,
    };
  } catch (err) {
    console.error("Error fetching organization data:", err);
    return {
      organization: null,
      branding: null,
      membership: null,
      error: err as Error,
    };
  }
}

/**
 * Custom hook for managing organization data state.
 */
export function useOrgData(userId: string | undefined) {
  const [state, setState] = useState<OrgDataState>({
    organization: null,
    branding: null,
    membership: null,
    isLoading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({
        organization: null,
        branding: null,
        membership: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const result = await fetchOrganizationData(userId);
    setState({ ...result, isLoading: false });
  }, [userId]);

  return {
    ...state,
    refresh,
  };
}
