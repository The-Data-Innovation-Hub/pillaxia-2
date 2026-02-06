import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock auth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", email: "test@example.com" },
  }),
}));

const mockIsOnline = { current: true };
vi.mock("@/hooks/useOfflineStatus", () => ({
  useOfflineStatus: () => ({ isOnline: mockIsOnline.current }),
}));

// Mock schedule cache — use the actual method names: getTodaysSchedule, saveTodaysSchedule
const mockGetTodaysSchedule = vi.fn().mockResolvedValue([]);
const mockGetTimestamp = vi.fn().mockResolvedValue(null);
const mockSaveTodaysSchedule = vi.fn().mockResolvedValue(undefined);
const mockUpdateLogStatus = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/cache", () => ({
  scheduleCache: {
    getTodaysSchedule: (...args: unknown[]) => mockGetTodaysSchedule(...args),
    getCacheTimestamp: (...args: unknown[]) => mockGetTimestamp(...args),
    saveTodaysSchedule: (...args: unknown[]) => mockSaveTodaysSchedule(...args),
    updateLogStatus: (...args: unknown[]) => mockUpdateLogStatus(...args),
  },
  medicationCache: {
    getMedications: vi.fn().mockResolvedValue([]),
    getCacheTimestamp: vi.fn().mockResolvedValue(null),
    saveMedications: vi.fn(),
  },
}));

// Mock DB
const mockScheduleData = [
  {
    id: "dose-1",
    medication_id: "med-1",
    user_id: "test-user-id",
    scheduled_time: new Date().toISOString(),
    status: "pending",
    taken_at: null,
    medications: { name: "Aspirin", dosage: "100", dosage_unit: "mg", form: "tablet" },
    medication_schedules: { quantity: 1, with_food: false },
  },
];

vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockScheduleData, error: null }),
            }),
          }),
        }),
      }),
    })),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("useCachedTodaysSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.current = true;
    mockGetTodaysSchedule.mockResolvedValue([]);
    mockGetTimestamp.mockResolvedValue(null);
  });

  it("returns schedule data and loading state", async () => {
    const { useCachedTodaysSchedule } = await import("@/hooks/useCachedTodaysSchedule");
    const { result } = renderHook(() => useCachedTodaysSchedule());

    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.logs).toBeDefined();
  });

  it("loads from cache first when available", async () => {
    mockGetTodaysSchedule.mockResolvedValue(mockScheduleData);
    mockGetTimestamp.mockResolvedValue(Date.now());

    const { useCachedTodaysSchedule } = await import("@/hooks/useCachedTodaysSchedule");
    const { result } = renderHook(() => useCachedTodaysSchedule());

    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetTodaysSchedule).toHaveBeenCalled();
  });

  it("does not fetch from network when offline", async () => {
    mockIsOnline.current = false;
    mockGetTodaysSchedule.mockResolvedValue(mockScheduleData);
    mockGetTimestamp.mockResolvedValue(Date.now());

    const { useCachedTodaysSchedule } = await import("@/hooks/useCachedTodaysSchedule");
    const { result } = renderHook(() => useCachedTodaysSchedule());

    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current.loading).toBe(false);
    });

    // Should not save to cache when offline
    expect(mockSaveTodaysSchedule).not.toHaveBeenCalled();
  });
});
