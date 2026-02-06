/**
 * Tests for authentication hooks.
 * Covers useAuthState and useAuthActions wrappers around AuthContext.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuthState } from "@/hooks/useAuthState";
import { useAuthActions } from "@/hooks/useAuthActions";

// Mock MSAL / Azure auth
vi.mock("@/lib/azure-auth", () => ({
  getMsalInstance: vi.fn(() => Promise.resolve({
    getAllAccounts: vi.fn(() => []),
    handleRedirectPromise: vi.fn(() => Promise.resolve(null)),
    acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
    loginRedirect: vi.fn(),
    logoutRedirect: vi.fn(),
  })),
  handleRedirectPromise: vi.fn(() => Promise.resolve(null)),
  getAccount: vi.fn(() => null),
  acquireTokenSilent: vi.fn(() => Promise.resolve(null)),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
  getLoginScopes: vi.fn(() => ["openid", "profile", "email"]),
}));

// Mock API client
vi.mock("@/integrations/api/client", () => ({
  apiClient: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
  setSentryContext: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe("useAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it("should set loading to false after initialization", async () => {
    const { result } = renderHook(() => useAuthState(), { wrapper });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});

describe("useAuthActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide signIn function", async () => {
    const { result } = renderHook(() => useAuthActions(), { wrapper });
    await waitFor(() => expect(typeof result.current.signIn).toBe("function"));
    expect(typeof result.current.signIn).toBe("function");
  });

  it("should provide signUp function", async () => {
    const { result } = renderHook(() => useAuthActions(), { wrapper });
    await waitFor(() => expect(typeof result.current.signUp).toBe("function"));
    expect(typeof result.current.signUp).toBe("function");
  });

  it("should provide signOut function", async () => {
    const { result } = renderHook(() => useAuthActions(), { wrapper });
    await waitFor(() => expect(typeof result.current.signOut).toBe("function"));
    expect(typeof result.current.signOut).toBe("function");
  });
});
