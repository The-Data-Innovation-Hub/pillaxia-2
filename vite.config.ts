import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Generate build timestamp for automatic versioning
const buildTimestamp = new Date().toISOString();
const buildDate = buildTimestamp.split('T')[0];
// Generate build number from timestamp (YYYYMMDD.HHMM format)
const now = new Date();
const buildNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Upload source maps to Sentry in CI (requires SENTRY_AUTH_TOKEN env var)
    mode === "production" && process.env.SENTRY_AUTH_TOKEN && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { assets: './dist/**' },
      release: { name: buildNumber },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances which can cause
    // "Invalid hook call" / "Cannot read properties of null (reading 'useRef')"
    // especially in Radix providers.
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // Ensure dependencies resolve to the same React instance.
    include: ["react", "react-dom"],
  },
  build: {
    // Enable minification and tree-shaking
    minify: "esbuild",
    // Generate hidden source maps (not referenced in JS bundles — upload to Sentry only)
    sourcemap: 'hidden',
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large dependencies
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-charts": ["recharts"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-motion": ["framer-motion"],
          "vendor-date": ["date-fns"],
        },
      },
    },
    // Lower chunk size warning to catch bundle bloat early
    chunkSizeWarningLimit: 400,
  },
}));
