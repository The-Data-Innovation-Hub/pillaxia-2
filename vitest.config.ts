import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
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
      thresholds: {
        // Critical paths require 60% minimum coverage
        "src/contexts/AuthContext.tsx": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/useAuthActions.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/useAuthState.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        // Medication logging
        "src/hooks/useOfflineMedicationLog.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/useCachedMedications.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/useCachedTodaysSchedule.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        // Offline sync
        "src/hooks/useOfflineSync.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/useOfflineStatus.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/lib/offlineQueue.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/lib/cache/scheduleCache.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        // Notification delivery
        "src/hooks/useNotificationSettings.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/usePushNotifications.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "src/hooks/useUnifiedPushNotifications.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
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
