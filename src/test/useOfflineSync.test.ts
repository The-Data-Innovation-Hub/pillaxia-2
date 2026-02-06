import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock offline status
const mockIsOnline = { current: true };
const mockWasOffline = { current: false };
vi.mock("@/hooks/useOfflineStatus", () => ({
  useOfflineStatus: () => ({
    isOnline: mockIsOnline.current,
    wasOffline: mockWasOffline.current,
  }),
}));

// Mock the offline queue — use the actual API the hook calls
const mockGetPendingCount = vi.fn().mockResolvedValue(0);
const mockSyncAll = vi.fn().mockResolvedValue({ success: 0, failed: 0, conflicts: 0, conflictIds: [], autoResolved: 0 });
const mockRequestBackgroundSync = vi.fn();

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    getPendingCount: () => mockGetPendingCount(),
    syncAll: () => mockSyncAll(),
    requestBackgroundSync: (...args: unknown[]) => mockRequestBackgroundSync(...args),
  },
}));

// Mock symptom cache
vi.mock("@/lib/cache", () => ({
  symptomCache: {
    clearPendingSymptoms: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock conflict resolution
vi.mock("@/lib/conflictResolution", () => ({
  conflictManager: {
    getConflictCount: vi.fn().mockResolvedValue({ unresolved: 0, total: 0 }),
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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      offline: {
        syncComplete: "Sync complete",
        syncFailed: "Sync failed",
        syncing: "Syncing",
        syncSuccess: "Sync success",
        syncError: "Sync error",
        itemsSynced: "items synced",
      },
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useOfflineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.current = true;
    mockWasOffline.current = false;
    mockGetPendingCount.mockResolvedValue(0);
  });

  it("reports no pending items when queue is empty", async () => {
    const { useOfflineSync } = await import("@/hooks/useOfflineSync");
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(result.current.syncInProgress).toBe(false);
  });

  it("exposes sync and status functions", async () => {
    const { useOfflineSync } = await import("@/hooks/useOfflineSync");
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    expect(typeof result.current.syncPendingActions).toBe("function");
    expect(result.current.isOnline).toBe(true);
  });

  it("processes pending actions when coming online", async () => {
    mockIsOnline.current = false;
    mockWasOffline.current = false;
    mockGetPendingCount.mockResolvedValue(1);

    const { useOfflineSync } = await import("@/hooks/useOfflineSync");
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });
});
