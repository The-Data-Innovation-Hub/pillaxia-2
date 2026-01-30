import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import Auth from "@/pages/Auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthError } from "@supabase/supabase-js";

// Mock the supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: { locked: false }, error: null }),
  },
}));

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
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const signInButton = screen.getByRole("button", { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: "invalid-email" } });
      fireEvent.click(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
      });
    });

    it("shows validation error for short password", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signInButton = screen.getByRole("button", { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "short" } });
      fireEvent.click(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it("calls signInWithPassword on valid form submission", async () => {
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

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(signInButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "test@example.com",
          password: "password123",
        });
      });
    });

    it("displays error message on failed sign in", async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: createMockAuthError("Invalid credentials", 401),
      });

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signInButton = screen.getByRole("button", { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
      fireEvent.click(signInButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe("Sign Up Tab", () => {
    it("switches to sign up form when tab is clicked", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      // Click the "Sign up" button/link to switch to sign up mode
      const signUpLink = screen.getByText("Sign up");
      fireEvent.click(signUpLink);

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });
    });

    it("shows first name and last name fields in sign up form", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const signUpLink = screen.getByText("Sign up");
      fireEvent.click(signUpLink);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("John")).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
      });
    });

    it("calls signUp on valid form submission", async () => {
      const mockSignUp = vi.fn().mockResolvedValue({ data: { user: {} }, error: null });
      vi.mocked(supabase.auth.signUp).mockImplementation(mockSignUp);

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const signUpLink = screen.getByText("Sign up");
      fireEvent.click(signUpLink);

      await waitFor(() => {
        expect(screen.getByText("Create Your Account")).toBeInTheDocument();
      });

      const firstNameInput = screen.getByPlaceholderText("John");
      const lastNameInput = screen.getByPlaceholderText("Doe");
      const emailInput = screen.getByPlaceholderText("you@example.com");
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const signUpButton = screen.getByRole("button", { name: /create account/i });

      fireEvent.change(firstNameInput, { target: { value: "Test" } });
      fireEvent.change(lastNameInput, { target: { value: "User" } });
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.click(signUpButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled();
      });
    });
  });

  describe("Demo Mode", () => {
    it("does not show demo panel when VITE_ENABLE_DEMO is not set", async () => {
      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      expect(screen.queryByText(/demo accounts/i)).not.toBeInTheDocument();
    });
  });

  describe("Account Lockout", () => {
    it("calls check_account_locked when email is entered", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { 
          locked: true, 
          locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          minutes_remaining: 30 
        },
        error: null,
      });

      const Wrapper = createWrapper();
      render(<Auth />, { wrapper: Wrapper });
      
      await waitFor(() => {
        expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText("you@example.com");
      fireEvent.change(emailInput, { target: { value: "locked@example.com" } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(supabase.rpc).toHaveBeenCalledWith("check_account_locked", {
          p_email: "locked@example.com",
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

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
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
