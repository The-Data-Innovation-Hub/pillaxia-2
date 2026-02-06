import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the auth context
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
  }),
}));

// Mock DB
const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: {
    user_id: "test-user-id",
    email_enabled: true,
    push_enabled: false,
    sms_enabled: false,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
    daily_digest_enabled: true,
  },
  error: null,
});

const mockUpdate = vi.fn().mockReturnThis();
const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn((table: string) => {
      if (table === "notification_preferences") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          update: (data: unknown) => {
            mockUpdate(data);
            return { eq: mockUpdateEq };
          },
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useNotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads notification preferences on mount", async () => {
    // Dynamic import to ensure mocks are set up first
    const { useNotificationSettings } = await import("@/hooks/useNotificationSettings");

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // The hook should have attempted to fetch preferences
    expect(mockMaybeSingle).toHaveBeenCalled();
  });
});
