// Force clean module refresh - v3
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { validateEnvironment } from "./lib/validateEnv";

// Validate environment before anything else
validateEnvironment();

// Initialize Sentry before rendering
initSentry();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
