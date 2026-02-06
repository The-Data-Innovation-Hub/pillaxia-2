import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";

// Mock MSAL / Azure auth
const mockLoginRedirect = vi.fn();
vi.mock("@/lib/azure-auth", () => ({
  getMsalInstance: vi.fn(() => Promise.resolve({
    getAllAccounts: vi.fn(() => []),
    handleRedirectPromise: vi.fn(() => Promise.resolve(null)),
    acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
    loginRedirect: mockLoginRedirect,
    logoutRedirect: vi.fn(),
  })),
  getAccount: vi.fn(() => null),
  acquireTokenSilent: vi.fn(() => Promise.resolve({ accessToken: "test-token" })),
  loginRedirect: mockLoginRedirect,
  logoutRedirect: vi.fn(),
}));

// Mock API client
vi.mock("@/integrations/api/client", () => ({
  apiClient: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
  setSentryContext: vi.fn(),
}));

// Import after mocking
import Auth from "@/pages/Auth";

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe("Auth Page (Azure AD B2C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it("renders the Sign in with Microsoft button", async () => {
    const Wrapper = createWrapper();
    render(<Auth />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/sign in with microsoft/i)).toBeInTheDocument();
    });
  });

  it("calls loginRedirect when Sign in button is clicked", async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(<Auth />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/sign in with microsoft/i)).toBeInTheDocument();
    });

    const signInButton = screen.getByText(/sign in with microsoft/i);
    await user.click(signInButton);

    // The signIn function in AuthContext calls loginRedirect
    await waitFor(() => {
      expect(mockLoginRedirect).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has a sign in button that is accessible", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /sign in with microsoft/i });
        expect(button).toBeInTheDocument();
      });
    });
  });
});
