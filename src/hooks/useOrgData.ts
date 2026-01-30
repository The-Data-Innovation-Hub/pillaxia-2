/**
 * Hook for fetching and managing organization data.
 * Extracted from OrganizationContext for better separation of concerns.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    // First, get the user's profile to check for a preferred organization
    const { data: profileData } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Get the user's organization memberships
    const { data: memberDataList, error: memberError } = await supabase
      .from("organization_members")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("joined_at", { ascending: false });

    if (memberError) throw memberError;

    if (!memberDataList || memberDataList.length === 0) {
      return { organization: null, branding: null, membership: null, error: null };
    }

    // Prefer the organization set in the user's profile
    let memberData = memberDataList[0];
    if (profileData?.organization_id) {
      const preferredMembership = memberDataList.find(
        (m) => m.organization_id === profileData.organization_id
      );
      if (preferredMembership) {
        memberData = preferredMembership;
      }
    }

    // Fetch organization details
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", memberData.organization_id)
      .single();

    if (orgError) throw orgError;

    // Fetch branding
    const { data: brandingData, error: brandingError } = await supabase
      .from("organization_branding")
      .select("*")
      .eq("organization_id", memberData.organization_id)
      .maybeSingle();

    if (brandingError) throw brandingError;

    return {
      organization: orgData as Organization,
      branding: brandingData as OrganizationBranding | null,
      membership: memberData as OrganizationMember,
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
