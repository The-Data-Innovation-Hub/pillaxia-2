import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import React from "react";

// Mock MSAL / Azure auth
vi.mock("@/lib/azure-auth", () => ({
  getMsalInstance: vi.fn(() => Promise.resolve({
    getAllAccounts: vi.fn(() => []),
    handleRedirectPromise: vi.fn(() => Promise.resolve(null)),
    acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
    loginRedirect: vi.fn(),
    logoutRedirect: vi.fn(),
  })),
  getAccount: vi.fn(() => null),
  acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
}));

// Mock API client
vi.mock("@/integrations/api/client", () => ({
  apiClient: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
  setSentryContext: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth Hook (MSAL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("starts with loading true and no user", () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });

    it("sets loading to false after initialization", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("Auth Methods", () => {
    it("provides signIn function", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(typeof result.current.signIn).toBe("function");
    });

    it("provides signOut function", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(typeof result.current.signOut).toBe("function");
    });

    it("provides getToken function", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(typeof result.current.getToken).toBe("function");
    });

    it("provides hasRole function", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(typeof result.current.hasRole).toBe("function");
    });
  });
});

describe("useAuth - Context Error", () => {
  it("throws error when used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
    consoleSpy.mockRestore();
  });
});
