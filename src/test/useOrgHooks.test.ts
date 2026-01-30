/**
 * Tests for organization data hooks.
 * Covers useOrgData and useOrgBranding functionality.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useOrgData } from "@/hooks/useOrgData";
import { useOrgBranding, DEFAULT_BRANDING } from "@/hooks/useOrgBranding";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mockSupabase.from(table),
  },
}));

describe("useOrgData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    });
  });

  it("should return null organization when user has no memberships", async () => {
    const { result } = renderHook(() => useOrgData("user-123"));
    
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.organization).toBeNull();
    expect(result.current.membership).toBeNull();
  });

  it("should set isLoading to false when userId is undefined", async () => {
    const { result } = renderHook(() => useOrgData(undefined));
    
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.organization).toBeNull();
  });
});

describe("useOrgBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DOM styles
    document.documentElement.style.removeProperty("--org-primary");
    document.documentElement.style.removeProperty("--org-secondary");
    document.documentElement.style.removeProperty("--org-accent");
    document.documentElement.style.removeProperty("--org-radius");
  });

  it("should apply default branding when branding is null", () => {
    const mockRefresh = vi.fn();
    
    renderHook(() => useOrgBranding(null, undefined, mockRefresh));
    
    // Check that default branding is applied
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--org-primary")).toBe(DEFAULT_BRANDING.primary_color);
  });

  it("should apply custom branding when provided", () => {
    const mockRefresh = vi.fn();
    const customBranding = {
      id: "brand-1",
      organization_id: "org-1",
      app_name: "Custom App",
      primary_color: "100 50% 50%",
      secondary_color: "200 60% 60%",
      accent_color: "300 70% 70%",
      border_radius: "1rem",
      logo_url: null,
      logo_dark_url: null,
      favicon_url: null,
      font_family: "Arial",
      support_email: null,
      support_phone: null,
      terms_url: null,
      privacy_url: null,
      email_header_color: null,
      email_footer_text: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    renderHook(() => useOrgBranding(customBranding, "org-1", mockRefresh));
    
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--org-primary")).toBe("100 50% 50%");
    expect(root.style.getPropertyValue("--org-secondary")).toBe("200 60% 60%");
    expect(root.style.getPropertyValue("--org-radius")).toBe("1rem");
  });

  it("should provide updateBranding function", () => {
    const mockRefresh = vi.fn();
    
    const { result } = renderHook(() => 
      useOrgBranding(null, "org-1", mockRefresh)
    );
    
    expect(typeof result.current.updateBranding).toBe("function");
  });

  it("should throw error when updating branding without organization", async () => {
    const mockRefresh = vi.fn();
    
    const { result } = renderHook(() => 
      useOrgBranding(null, undefined, mockRefresh)
    );
    
    await expect(result.current.updateBranding({})).rejects.toThrow(
      "No organization to update"
    );
  });
});

describe("DEFAULT_BRANDING", () => {
  it("should have expected default values", () => {
    expect(DEFAULT_BRANDING.app_name).toBe("Pillaxia");
    expect(DEFAULT_BRANDING.primary_color).toBe("244 69% 31%");
    expect(DEFAULT_BRANDING.font_family).toBe("Inter, sans-serif");
    expect(DEFAULT_BRANDING.border_radius).toBe("0.5rem");
  });
});
