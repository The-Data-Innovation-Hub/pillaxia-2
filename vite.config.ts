import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
