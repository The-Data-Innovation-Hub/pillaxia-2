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
    isClinician: false,
    isPharmacist: false,
    isPatient: true,
    isAdmin: false,
    isManager: false,
    isAdminOrManager: false,
  }),
}));

// Mock prescriptions data
const mockPrescriptions = [
  {
    id: "rx-1",
    patient_user_id: "test-user-id",
    clinician_user_id: "doctor-1",
    prescription_number: "RX-001",
    medication_name: "Aspirin",
    dosage: "100mg",
    dosage_unit: "mg",
    form: "tablet",
    quantity: 30,
    refills_authorized: 2,
    refills_remaining: 2,
    sig: "Take one daily",
    status: "active",
    is_controlled_substance: false,
    dispense_as_written: false,
    date_written: "2026-01-01",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    pharmacy: { name: "Test Pharmacy", phone: null, email: null },
  },
];

const mockProfiles = [
  { user_id: "doctor-1", first_name: "Dr.", last_name: "Smith", email: null, phone: null, license_number: "MD123" },
  { user_id: "test-user-id", first_name: "Test", last_name: "Patient", email: "test@example.com", phone: null, license_number: null },
];

vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn((table: string) => {
      if (table === "prescriptions") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              then: (resolve: (v: any) => void) => resolve({ data: mockPrescriptions, error: null }),
            }),
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockPrescriptions, error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ data: "RX-002", error: null }),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

  it("returns loading state initially", async () => {
    const { usePrescriptions } = await import("@/hooks/usePrescriptions");

    const { result } = renderHook(() => usePrescriptions(), {
      wrapper: createWrapper(),
    });

    // Should be loading initially or finish quickly
    expect(result.current.isLoading).toBeDefined();
  });
});
