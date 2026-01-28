import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
}));
