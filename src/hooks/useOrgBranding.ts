/**
 * Hook for applying organization branding to the DOM.
 * Extracted from OrganizationContext for better separation of concerns.
 */
import { useEffect, useCallback } from "react";
import { db } from "@/integrations/db";
import type { OrganizationBranding } from "./useOrgData";

/**
 * Default branding when no organization is set.
 */
export const DEFAULT_BRANDING: Omit<
  OrganizationBranding,
  "id" | "organization_id" | "created_at" | "updated_at"
> = {
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

/**
 * Applies branding CSS variables to the document root.
 */
export function applyBrandingToDOM(
  branding: OrganizationBranding | null
): void {
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
    const link = document.querySelector(
      "link[rel~='icon']"
    ) as HTMLLinkElement;
    if (link) {
      link.href = branding.favicon_url;
    }
  }

  // Update document title with app name
  if (activeBranding.app_name && activeBranding.app_name !== "Pillaxia") {
    const baseTitle = document.title.replace(
      /^Pillaxia/,
      activeBranding.app_name
    );
    document.title = baseTitle.startsWith(activeBranding.app_name)
      ? baseTitle
      : `${activeBranding.app_name}`;
  }
}

/**
 * Custom hook for applying and updating organization branding.
 */
export function useOrgBranding(
  branding: OrganizationBranding | null,
  organizationId: string | undefined,
  onRefresh: () => Promise<void>
) {
  // Apply branding when it changes
  useEffect(() => {
    applyBrandingToDOM(branding);
  }, [branding]);

  /**
   * Updates organization branding in the database.
   */
  const updateBranding = useCallback(
    async (updates: Partial<OrganizationBranding>) => {
      if (!organizationId) throw new Error("No organization to update");

      const { error } = await db
        .from("organization_branding")
        .upsert(
          {
            organization_id: organizationId,
            ...updates,
          },
          { onConflict: "organization_id" }
        );

      if (error) throw error;

      // Refresh branding
      await onRefresh();
    },
    [organizationId, onRefresh]
  );

  return { updateBranding };
}
