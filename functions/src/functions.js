/**
 * Pillaxia Azure Functions - Entry point
 * Registers all function handlers
 *
 * Each import auto-registers its functions via app.http() / app.timer()
 * from the @azure/functions v4 programming model.
 */

// --- Existing functions (pre-migration) ---
import '../stripe-webhook/index.js';

// --- API Endpoints (HTTP triggers) ---
import './api-endpoints.js';

// --- Notification Senders (HTTP triggers) ---
import './notification-senders.js';

// --- Scheduled Jobs (Timer triggers) ---
import './scheduled-jobs.js';

// --- Webhook Handlers (HTTP triggers) ---
import './webhook-handlers.js';
