import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOfflineMedicationLog } from "@/hooks/useOfflineMedicationLog";

// Mock dependencies
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock("@/integrations/db", () => ({
  db: {
    from: vi.fn(() => ({
      update: (data: unknown) => {
        mockUpdate(data);
        return { eq: mockEq };
      },
    })),
  },
}));

const mockIsOnline = { current: true };
vi.mock("@/hooks/useOfflineStatus", () => ({
  useOfflineStatus: () => ({ isOnline: mockIsOnline.current }),
}));

vi.mock("@/lib/azure-auth", () => ({
  acquireTokenSilent: vi.fn(() => Promise.resolve("mock-token")),
}));

const mockAddAction = vi.fn();
vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    addAction: (...args: unknown[]) => mockAddAction(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      offline: {
        updateFailed: "Update failed",
        notAuthenticated: "Not authenticated",
        queuedForSync: "Queued for sync",
        queueFailed: "Queue failed",
      },
    },
  }),
}));

describe("useOfflineMedicationLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline.current = true;
    mockEq.mockResolvedValue({ data: null, error: null });
  });

  it("returns logMedication function and isOnline status", () => {
    const { result } = renderHook(() => useOfflineMedicationLog());
    expect(result.current.logMedication).toBeDefined();
    expect(typeof result.current.logMedication).toBe("function");
    expect(result.current.isOnline).toBe(true);
  });

  it("logs medication directly when online", async () => {
    const { result } = renderHook(() => useOfflineMedicationLog());

    let success = false;
    await act(async () => {
      success = await result.current.logMedication({
        logId: "test-log-id",
        status: "taken",
        takenAt: "2026-01-01T10:00:00Z",
      });
    });

    expect(success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "taken", taken_at: "2026-01-01T10:00:00Z" })
    );
  });

  it("returns false when online update fails", async () => {
    mockEq.mockResolvedValueOnce({ data: null, error: new Error("DB error") });
    const { result } = renderHook(() => useOfflineMedicationLog());

    let success = true;
    await act(async () => {
      success = await result.current.logMedication({
        logId: "test-log-id",
        status: "taken",
      });
    });

    expect(success).toBe(false);
  });

  it("queues action when offline", async () => {
    mockIsOnline.current = false;
    const { result } = renderHook(() => useOfflineMedicationLog());

    let success = false;
    await act(async () => {
      success = await result.current.logMedication({
        logId: "test-log-id",
        status: "skipped",
      });
    });

    expect(success).toBe(true);
    expect(mockAddAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "medication_log",
        method: "PATCH",
        body: expect.objectContaining({ status: "skipped" }),
      })
    );
  });
});
