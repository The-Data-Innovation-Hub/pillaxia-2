import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import React from "react";

const mockGetStoredNativeTokens = vi.fn();
const mockClearStoredNativeTokens = vi.fn();
const mockDecodeIdTokenPayload = vi.fn();
const mockBuildWebAuthUrl = vi.fn();
const mockStorePkceVerifier = vi.fn();
const mockFetchMe = vi.fn();

vi.mock("@/lib/native-auth", () => ({
  getStoredNativeTokens: () => mockGetStoredNativeTokens(),
  clearStoredNativeTokens: () => mockClearStoredNativeTokens(),
  decodeIdTokenPayload: (token: string) => mockDecodeIdTokenPayload(token),
  buildWebAuthUrl: () => mockBuildWebAuthUrl(),
  storePkceVerifier: (state: string, verifier: string) => mockStorePkceVerifier(state, verifier),
}));

vi.mock("@/lib/azure-api", () => ({
  fetchMe: (token: string) => mockFetchMe(token),
}));

vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
  setSentryContext: vi.fn(),
}));

const mockUser = { id: "test-user-id", email: "test@example.com" };
const mockProfile = {
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  phone: null,
  organization: null,
  language_preference: "en",
  avatar_url: null,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("useAuth Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoredNativeTokens.mockReturnValue(null);
    mockFetchMe.mockResolvedValue(null);
  });

  describe("Initial State", () => {
    it("ends with no user when no tokens", async () => {
      mockGetStoredNativeTokens.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });

    it("sets loading to false after initialization when no tokens", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("Session Management", () => {
    it("loads session from stored tokens and fetchMe", async () => {
      mockGetStoredNativeTokens.mockReturnValue({
        access_token: "test-token",
        id_token: "mock-id-token",
      });
      mockDecodeIdTokenPayload.mockReturnValue({
        oid: "test-user-id",
        sub: "test-user-id",
        email: "test@example.com",
      });
      mockFetchMe.mockResolvedValue({
        user_id: "test-user-id",
        profile: mockProfile,
        roles: ["patient"],
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).not.toBe(null);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).not.toBe(null);
      expect(result.current.session?.access_token).toBe("test-token");
      expect(result.current.profile).toEqual(mockProfile);
      expect(result.current.roles).toEqual(["patient"]);
    });

    it("clears state on signOut", async () => {
      mockGetStoredNativeTokens.mockReturnValue({
        access_token: "test-token",
        id_token: "mock-id-token",
      });
      mockDecodeIdTokenPayload.mockReturnValue({ oid: "test-user-id", sub: "test-user-id" });
      mockFetchMe.mockResolvedValue({ user_id: "test-user-id", profile: null, roles: [] });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockClearStoredNativeTokens).toHaveBeenCalled();
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });
  });

  describe("signIn", () => {
    it("calls buildWebAuthUrl and redirects", async () => {
      const mockAssign = vi.fn();
      Object.defineProperty(window, "location", {
        value: { href: "", assign: mockAssign },
        writable: true,
      });
      mockBuildWebAuthUrl.mockResolvedValue({
        url: "https://login.microsoftonline.com/...",
        state: "state-123",
        codeVerifier: "verifier-456",
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signIn();

      expect(mockBuildWebAuthUrl).toHaveBeenCalled();
      expect(mockStorePkceVerifier).toHaveBeenCalledWith("state-123", "verifier-456");
      expect(response.error).toBe(null);
      expect(window.location.href).toBe("https://login.microsoftonline.com/...");
    });

    it("returns error when buildWebAuthUrl fails", async () => {
      const err = new Error("Auth config error");
      mockBuildWebAuthUrl.mockRejectedValue(err);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signIn();

      expect(response.error).toEqual(err);
    });
  });

  describe("signUp", () => {
    it("delegates to signIn (Entra flow)", async () => {
      mockBuildWebAuthUrl.mockResolvedValue({
        url: "https://login.microsoftonline.com/...",
        state: "state",
        codeVerifier: "verifier",
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signUp(
        "new@example.com",
        "password123",
        "John",
        "Doe",
        "patient"
      );

      expect(mockBuildWebAuthUrl).toHaveBeenCalled();
      expect(response.error).toBe(null);
    });
  });

  describe("Role Checks", () => {
    it("hasRole returns true when role is in roles", async () => {
      mockGetStoredNativeTokens.mockReturnValue({
        access_token: "token",
        id_token: "id-token",
      });
      mockDecodeIdTokenPayload.mockReturnValue({ oid: "uid", sub: "uid" });
      mockFetchMe.mockResolvedValue({
        user_id: "uid",
        profile: mockProfile,
        roles: ["patient", "clinician"],
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.roles).toContain("patient");
      });

      expect(result.current.hasRole("patient")).toBe(true);
      expect(result.current.hasRole("clinician")).toBe(true);
      expect(result.current.hasRole("admin")).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("handles missing tokens gracefully", async () => {
      mockGetStoredNativeTokens.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
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
