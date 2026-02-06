import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the auth context — isAdmin: true so the query runs
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
    isAdmin: true,
  }),
}));

// Mock DB — the hook queries notification_settings table with .select("*").order("setting_key")
const mockSettingsData = [
  {
    id: "ns-1",
    setting_key: "medication_reminders",
    is_enabled: true,
    description: "Send medication reminders",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "ns-2",
    setting_key: "missed_dose_alerts",
    is_enabled: true,
    description: "Send missed dose alerts",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockOrder = vi.fn().mockResolvedValue({ data: mockSettingsData, error: null });

vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn((table: string) => {
      if (table === "notification_settings") {
        return {
          select: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
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

  it("loads notification settings on mount", async () => {
    // Dynamic import to ensure mocks are set up first
    const { useNotificationSettings } = await import("@/hooks/useNotificationSettings");

    const { result } = renderHook(() => useNotificationSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The hook should have fetched settings
    expect(mockOrder).toHaveBeenCalled();
    expect(result.current.settings).toBeDefined();
  });
});
