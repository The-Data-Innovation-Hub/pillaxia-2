import "@testing-library/jest-dom";
import { vi, beforeAll, afterAll } from "vitest";

// Mock matchMedia for components using media queries
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
}));

// Mock IndexedDB for offline cache tests
const indexedDB = {
  open: vi.fn(() => ({
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
          getAll: vi.fn(),
          clear: vi.fn(),
        })),
      })),
    },
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
  })),
  deleteDatabase: vi.fn(),
};

Object.defineProperty(window, "indexedDB", {
  value: indexedDB,
  writable: true,
});

// Mock Azure auth (MSAL)
vi.mock("@/lib/azure-auth", () => ({
  getMsalInstance: vi.fn(() => Promise.resolve({
    getAllAccounts: vi.fn(() => []),
    handleRedirectPromise: vi.fn(() => Promise.resolve(null)),
    acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
    loginRedirect: vi.fn(),
    logoutRedirect: vi.fn(),
  })),
  getAccount: vi.fn(() => null),
  acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
}));

// Mock API client (database access layer)
vi.mock("@/integrations/api/client", () => ({
  apiClient: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Suppress console errors in tests unless explicitly testing error states
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render") ||
        args[0].includes("act(...)"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
