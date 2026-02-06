import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCachedMedications } from "@/hooks/useCachedMedications";

// Mock dependencies
const mockMedications = [
  { id: "med-1", name: "Aspirin", user_id: "test-user", medication_schedules: [] },
  { id: "med-2", name: "Ibuprofen", user_id: "test-user", medication_schedules: [] },
];

const mockIsOnline = { current: true };
vi.mock("@/hooks/useOfflineStatus", () => ({
  useOfflineStatus: () => ({ isOnline: mockIsOnline.current }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user", email: "test@example.com" },
  }),
}));

const mockGetMedications = vi.fn().mockResolvedValue([]);
const mockGetCacheTimestamp = vi.fn().mockResolvedValue(null);
const mockSaveMedications = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/cache", () => ({
  medicationCache: {
    getMedications: (...args: unknown[]) => mockGetMedications(...args),
    getCacheTimestamp: (...args: unknown[]) => mockGetCacheTimestamp(...args),
    saveMedications: (...args: unknown[]) => mockSaveMedications(...args),
  },
}));

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockResolvedValue({ data: mockMedications, error: null });

vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn(() => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { order: mockOrder };
          },
        };
      },
    })),
  },
}));

describe("useCachedMedications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.current = true;
    mockGetMedications.mockResolvedValue([]);
    mockGetCacheTimestamp.mockResolvedValue(null);
    mockOrder.mockResolvedValue({ data: mockMedications, error: null });
  });

  it("returns medications, loading state, and helper functions", async () => {
    const { result } = renderHook(() => useCachedMedications());

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.medications).toEqual(mockMedications);
    expect(result.current.refetch).toBeDefined();
  });

  it("loads from cache first when available", async () => {
    mockGetMedications.mockResolvedValue(mockMedications);
    mockGetCacheTimestamp.mockResolvedValue(Date.now());

    const { result } = renderHook(() => useCachedMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetMedications).toHaveBeenCalledWith("test-user");
    expect(result.current.medications.length).toBeGreaterThan(0);
  });

  it("fetches from network when online", async () => {
    const { result } = renderHook(() => useCachedMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have attempted to save to cache
    expect(mockSaveMedications).toHaveBeenCalled();
    expect(result.current.isFromCache).toBe(false);
  });

  it("does not fetch from network when offline", async () => {
    mockIsOnline.current = false;
    mockGetMedications.mockResolvedValue(mockMedications);
    mockGetCacheTimestamp.mockResolvedValue(Date.now());

    const { result } = renderHook(() => useCachedMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should return cached data
    expect(result.current.isFromCache).toBe(true);
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it("handles network errors gracefully", async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error("Network error") });

    const { result } = renderHook(() => useCachedMedications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
