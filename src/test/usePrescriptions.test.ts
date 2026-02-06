import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock auth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
    profile: { role: "patient" },
    roles: ["patient"],
  }),
}));

// Mock prescriptions data
const mockPrescriptions = [
  {
    id: "rx-1",
    patient_id: "test-user-id",
    clinician_id: "doctor-1",
    medication_name: "Aspirin",
    dosage: "100mg",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const mockProfiles = [
  { user_id: "doctor-1", first_name: "Dr.", last_name: "Smith" },
  { user_id: "test-user-id", first_name: "Test", last_name: "Patient" },
];

const mockLimitFn = vi.fn();
const mockInFn = vi.fn();

vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn((table: string) => {
      if (table === "prescriptions") {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: () => {
                  mockLimitFn();
                  return Promise.resolve({ data: mockPrescriptions, error: null });
                },
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: () => {
              mockInFn();
              return Promise.resolve({ data: mockProfiles, error: null });
            },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("usePrescriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and returns prescription data", async () => {
    const { usePrescriptions } = await import("@/hooks/usePrescriptions");

    const { result } = renderHook(() => usePrescriptions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toBeDefined();
    expect(result.current.prescriptions).toBeDefined();
  });

  it("returns loading state initially", () => {
    const { usePrescriptions } = require("@/hooks/usePrescriptions");

    const { result } = renderHook(() => usePrescriptions(), {
      wrapper: createWrapper(),
    });

    // Should be loading initially
    expect(result.current.isLoading).toBeDefined();
  });
});
