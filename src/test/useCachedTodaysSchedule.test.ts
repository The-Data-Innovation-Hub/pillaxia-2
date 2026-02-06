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

// Mock schedule cache
const mockGetSchedule = vi.fn().mockResolvedValue([]);
const mockGetTimestamp = vi.fn().mockResolvedValue(null);
const mockSaveSchedule = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/cache", () => ({
  scheduleCache: {
    getSchedule: (...args: unknown[]) => mockGetSchedule(...args),
    getCacheTimestamp: (...args: unknown[]) => mockGetTimestamp(...args),
    saveSchedule: (...args: unknown[]) => mockSaveSchedule(...args),
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
    mockGetSchedule.mockResolvedValue([]);
    mockGetTimestamp.mockResolvedValue(null);
  });

  it("returns schedule data and loading state", async () => {
    const { useCachedTodaysSchedule } = await import("@/hooks/useCachedTodaysSchedule");
    const { result } = renderHook(() => useCachedTodaysSchedule());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current.loading !== undefined || result.current.isLoading !== undefined).toBe(true);
  });

  it("loads from cache first when available", async () => {
    mockGetSchedule.mockResolvedValue(mockScheduleData);
    mockGetTimestamp.mockResolvedValue(Date.now());

    const { useCachedTodaysSchedule } = await import("@/hooks/useCachedTodaysSchedule");
    const { result } = renderHook(() => useCachedTodaysSchedule());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(mockGetSchedule).toHaveBeenCalled();
  });

  it("does not fetch from network when offline", async () => {
    mockIsOnline.current = false;
    mockGetSchedule.mockResolvedValue(mockScheduleData);
    mockGetTimestamp.mockResolvedValue(Date.now());

    const { useCachedTodaysSchedule } = await import("@/hooks/useCachedTodaysSchedule");
    const { result } = renderHook(() => useCachedTodaysSchedule());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Should not save to cache when offline
    expect(mockSaveSchedule).not.toHaveBeenCalled();
  });
});
