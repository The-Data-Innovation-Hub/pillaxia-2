/**
 * Tests for authentication hooks.
 * Covers useAuthState and useAuthActions wrappers around AuthContext.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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

describe("useAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with loading state", () => {
    const { result } = renderHook(() => useAuthState());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it("should set loading to false after initialization", async () => {
    const { result } = renderHook(() => useAuthState());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});

describe("useAuthActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide signIn function", () => {
    const { result } = renderHook(() => useAuthActions());
    expect(typeof result.current.signIn).toBe("function");
  });

  it("should provide signUp function", () => {
    const { result } = renderHook(() => useAuthActions());
    expect(typeof result.current.signUp).toBe("function");
  });

  it("should provide signOut function", () => {
    const { result } = renderHook(() => useAuthActions());
    expect(typeof result.current.signOut).toBe("function");
  });
});
