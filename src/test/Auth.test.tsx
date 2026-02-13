import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";

const mockGetStoredNativeTokens = vi.fn();
const mockBuildWebAuthUrl = vi.fn();
const mockStorePkceVerifier = vi.fn();
const mockFetchMe = vi.fn();

vi.mock("@/lib/native-auth", () => ({
  getStoredNativeTokens: () => mockGetStoredNativeTokens(),
  clearStoredNativeTokens: vi.fn(),
  decodeIdTokenPayload: vi.fn(),
  buildWebAuthUrl: () => mockBuildWebAuthUrl(),
  storePkceVerifier: (state: string, verifier: string) => mockStorePkceVerifier(state, verifier),
}));

vi.mock("@/lib/azure-api", () => ({
  fetchMe: (token: string) => mockFetchMe(token),
}));

vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
  setSentryContext: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/useBiometricAuth", () => ({
  useBiometricAuth: () => ({
    isAvailable: false,
    isEnabled: false,
    biometryName: "",
    getCredentials: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePasswordBreachCheck", () => ({
  usePasswordBreachCheck: () => ({
    checkPassword: vi.fn().mockResolvedValue({ breached: false, count: 0 }),
    isChecking: false,
    breachResult: null,
    clearResult: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLoginAttempts", () => ({
  useLoginAttempts: () => ({
    checkAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
    recordLoginAttempt: vi.fn().mockResolvedValue({ locked: false }),
    formatLockoutMessage: vi.fn().mockReturnValue(""),
  }),
}));

vi.mock("@/hooks/useSecurityEvents", () => ({
  useSecurityEvents: () => ({
    logSecurityEvent: vi.fn(),
  }),
}));

import Auth from "@/pages/Auth";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system">
        <BrowserRouter>
          <AuthProvider>{children}</AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe("Auth Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockGetStoredNativeTokens.mockReturnValue(null);
    mockFetchMe.mockResolvedValue(null);
  });

  describe("Sign In", () => {
    it("renders welcome and Microsoft sign-in", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Welcome")).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Sign in with your Microsoft account to access your health dashboard/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sign in with Microsoft/i })).toBeInTheDocument();
    });

    it("calls signIn (buildWebAuthUrl) when Sign in with Microsoft is clicked", async () => {
      const user = userEvent.setup();
      mockBuildWebAuthUrl.mockResolvedValue({
        url: "https://login.microsoftonline.com/authorize",
        state: "state-1",
        codeVerifier: "verifier-1",
      });

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Welcome")).toBeInTheDocument();
      });

      const signInButton = screen.getByRole("button", { name: /Sign in with Microsoft/i });
      await user.click(signInButton);

      await waitFor(() => {
        expect(mockBuildWebAuthUrl).toHaveBeenCalled();
      });
      expect(mockStorePkceVerifier).toHaveBeenCalledWith("state-1", "verifier-1");
    });

    it("shows error when signIn returns error", async () => {
      const user = userEvent.setup();
      mockBuildWebAuthUrl.mockRejectedValue(new Error("Auth config missing"));

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Welcome")).toBeInTheDocument();
      });

      const signInButton = screen.getByRole("button", { name: /Sign in with Microsoft/i });
      await user.click(signInButton);

      await waitFor(() => {
        expect(screen.getByText("Auth config missing")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("has Back to Home button", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Welcome")).toBeInTheDocument();
      });

      expect(screen.getByRole("button", { name: /Back to Home/i })).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("sign-in button is accessible", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("Welcome")).toBeInTheDocument();
      });

      const signInButton = screen.getByRole("button", { name: /Sign in with Microsoft/i });
      expect(signInButton).toBeInTheDocument();
    });
  });
});
