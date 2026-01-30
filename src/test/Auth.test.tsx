import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthError } from "@supabase/supabase-js";

// Mock the supabase client BEFORE importing Auth component
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: { locked: false }, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  },
}));

// Import after mocking
import Auth from "@/pages/Auth";
import { supabase } from "@/integrations/supabase/client";

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Sentry
vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
  setSentryContext: vi.fn(),
}));

// Mock biometric auth hook (not available in test environment)
vi.mock("@/hooks/useBiometricAuth", () => ({
  useBiometricAuth: () => ({
    isAvailable: false,
    isEnabled: false,
    biometryName: "",
    getCredentials: vi.fn(),
    isLoading: false,
  }),
}));

// Mock password breach check hook
vi.mock("@/hooks/usePasswordBreachCheck", () => ({
  usePasswordBreachCheck: () => ({
    checkPassword: vi.fn().mockResolvedValue({ breached: false, count: 0 }),
    isChecking: false,
    breachResult: null,
    clearResult: vi.fn(),
  }),
}));

// Mock login attempts hook
vi.mock("@/hooks/useLoginAttempts", () => ({
  useLoginAttempts: () => ({
    checkAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
    recordLoginAttempt: vi.fn().mockResolvedValue({ locked: false }),
    formatLockoutMessage: vi.fn().mockReturnValue(""),
  }),
}));

// Mock security events hook
vi.mock("@/hooks/useSecurityEvents", () => ({
  useSecurityEvents: () => ({
    logSecurityEvent: vi.fn(),
  }),
}));

// Custom wrapper for Auth tests including AuthProvider
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

// Helper to create a mock AuthError
const createMockAuthError = (message: string, status: number) => {
  const error = new AuthError(message, status);
  return error;
};

describe("Auth Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe("Sign In Tab", () => {
    it("renders sign in form by default", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      // Wait for auth context to initialize
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });
      // Use the actual placeholder from the component
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    });

    it("shows validation error for invalid email", async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const form = emailInput.closest("form");

      await user.type(emailInput, "invalid-email");
      
      // Submit the form directly
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
      });
    });

    it("shows validation error for short password", async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const form = emailInput.closest("form");

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "short");
      
      // Submit the form directly
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it("calls signInWithPassword on valid form submission", async () => {
      const user = userEvent.setup();
      const mockSignIn = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(mockSignIn);

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signInButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(signInButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });
    });

    it("calls signInWithPassword on failed login attempt", async () => {
      const user = userEvent.setup();
      const mockSignIn = vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: createMockAuthError("Invalid credentials", 401),
      });
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(mockSignIn);

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signInButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "wrongpassword");
      await user.click(signInButton);

      // Verify that signInWithPassword was called with correct credentials
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "wrongpassword",
        });
      });
    });
  });

  describe("Sign Up Tab", () => {
    it("switches to sign up form when link is clicked", async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      // Click the "Sign up" button/link to switch to sign up mode
      const signUpLink = screen.getByText("Sign up");
      await user.click(signUpLink);

      // Use getByRole for heading to be more specific
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
      });
    });

    it("shows first name and last name fields in sign up form", async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const signUpLink = screen.getByText("Sign up");
      await user.click(signUpLink);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
      });
    });

    it("calls signUp on valid form submission", async () => {
      const user = userEvent.setup();
      const mockSignUp = vi.fn().mockResolvedValue({ data: { user: {} }, error: null });
      vi.mocked(supabase.auth.signUp).mockImplementation(mockSignUp);

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const signUpLink = screen.getByText("Sign up");
      await user.click(signUpLink);

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
      });

      const firstNameInput = screen.getByPlaceholderText("John");
      const lastNameInput = screen.getByPlaceholderText("Doe");
      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signUpButton = screen.getByRole("button", { name: /create account/i });

      await user.type(firstNameInput, "Test");
      await user.type(lastNameInput, "User");
      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(signUpButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled();
      });
    });
  });

  describe("Demo Mode", () => {
    it("does not show demo panel when VITE_ENABLE_DEMO is false", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      expect(screen.queryByText(/demo accounts/i)).not.toBeInTheDocument();
    });
  });

  describe("Account Lockout", () => {
    it("submits form with valid credentials after lockout check", async () => {
      const user = userEvent.setup();
      const mockSignIn = vi.fn().mockResolvedValue({ data: {}, error: null });
      vi.mocked(supabase.auth.signInWithPassword).mockImplementation(mockSignIn);

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signInButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(signInButton);

      // Verify form submission succeeded - signInWithPassword should be called
      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper form labels", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      // Check for the label elements specifically
      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("Password")).toBeInTheDocument();
      // Verify inputs are present
      expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    });

    it("form submit button is accessible", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const signInButton = screen.getByRole("button", { name: /sign in/i });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toHaveAttribute("type", "submit");
    });
  });
});
