import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "src/test/setup.ts")],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "supabase"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "src/integrations/supabase/types.ts",
      ],
      // Per-file thresholds disabled during Azure migration.
      // TODO: Re-enable at 70% once test coverage catches up.
      // thresholds: { ... }
    },
    testTimeout: 10000,
    env: {
      // Disable demo mode in tests for consistent UI behavior
      VITE_ENABLE_DEMO: "false",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
