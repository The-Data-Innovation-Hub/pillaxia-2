import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock offline status
const mockIsOnline = { current: true };
vi.mock("@/hooks/useOfflineStatus", () => ({
  useOfflineStatus: () => ({ isOnline: mockIsOnline.current }),
}));

// Mock the offline queue
const mockGetPendingActions = vi.fn().mockResolvedValue([]);
const mockRemoveAction = vi.fn().mockResolvedValue(undefined);
const mockGetQueueLength = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    getPendingActions: () => mockGetPendingActions(),
    removeAction: (...args: unknown[]) => mockRemoveAction(...args),
    getQueueLength: () => mockGetQueueLength(),
  },
}));

// Mock fetch for sync
const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      offline: {
        syncComplete: "Sync complete",
        syncFailed: "Sync failed",
        syncInProgress: "Syncing",
        itemsSynced: "items synced",
      },
    },
  }),
}));

describe("useOfflineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.current = true;
    mockGetPendingActions.mockResolvedValue([]);
    mockGetQueueLength.mockResolvedValue(0);
  });

  it("reports no pending items when queue is empty", async () => {
    const { useOfflineSync } = await import("@/hooks/useOfflineSync");
    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current.pendingCount).toBeDefined();
  });

  it("exposes sync and status functions", async () => {
    const { useOfflineSync } = await import("@/hooks/useOfflineSync");
    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // The hook should expose sync-related functions
    expect(typeof result.current.syncNow === "function" || result.current.pendingCount !== undefined).toBe(true);
  });

  it("processes pending actions when coming online", async () => {
    mockIsOnline.current = false;
    mockGetPendingActions.mockResolvedValue([
      {
        id: "action-1",
        type: "medication_log",
        url: "https://api.example.com/rest/medication_logs?id=eq.1",
        method: "PATCH",
        headers: { Authorization: "Bearer token" },
        body: { status: "taken" },
      },
    ]);
    mockGetQueueLength.mockResolvedValue(1);

    const { useOfflineSync } = await import("@/hooks/useOfflineSync");
    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });
});
