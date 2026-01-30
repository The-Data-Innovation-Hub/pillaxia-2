import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllProvidersProps {
  children: React.ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          {children}
          <Toaster />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render };

// Helper to create mock user
export const createMockUser = (overrides = {}) => ({
  id: "test-user-id",
  email: "test@example.com",
  created_at: new Date().toISOString(),
  ...overrides,
});

// Helper to create mock session
export const createMockSession = (overrides = {}) => ({
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: createMockUser(),
  ...overrides,
});

// Helper to create mock profile
export const createMockProfile = (overrides = {}) => ({
  id: "test-profile-id",
  user_id: "test-user-id",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  phone: null,
  organization: null,
  language_preference: "en",
  avatar_url: null,
  ...overrides,
});

// Wait for async operations
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));
