/**
 * Tests for authentication hooks and context.
 * Covers useAuthState, useAuthActions, and AuthContext integration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuthState } from "@/hooks/useAuthState";
import { useAuthActions } from "@/hooks/useAuthActions";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
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

  it("should handle signIn success", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "123" }, session: {} },
      error: null,
    } as any);

    const { result } = renderHook(() => useAuthActions());
    const response = await result.current.signIn("test@example.com", "password");

    expect(response.error).toBeNull();
  });

  it("should handle signIn error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const testError = new Error("Invalid credentials");
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: testError,
    } as any);

    const { result } = renderHook(() => useAuthActions());
    const response = await result.current.signIn("test@example.com", "wrong");

    expect(response.error).toEqual(testError);
  });

  it("should handle signUp with profile data", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { id: "123" }, session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAuthActions());
    const response = await result.current.signUp(
      "test@example.com",
      "password",
      "John",
      "Doe",
      "patient"
    );

    expect(response.error).toBeNull();
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        password: "password",
        options: expect.objectContaining({
          data: expect.objectContaining({
            first_name: "John",
            last_name: "Doe",
            role: "patient",
          }),
        }),
      })
    );
  });
});
