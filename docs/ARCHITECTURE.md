# Architecture Overview

This document describes the high-level architecture of Pillaxia Companion, a medication adherence platform built with React, TypeScript, and Azure cloud services.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Applications                          │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   Web (React)   │  iOS (Capacitor) │  Android (Capacitor)           │
└────────┬────────┴────────┬────────┴─────────────┬───────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Azure App Service (Express API)                    │
│   Auth Middleware │ Rate Limiting │ Zod Validation │ Pino Logging    │
└────────┬────────────────┬────────────────────────┬──────────────────┘
         │                │                        │
         ▼                ▼                        ▼
┌─────────────────┬─────────────────┬──────────────────────────────────┐
│ Azure PostgreSQL │ Azure Functions │ Azure AD B2C + Azure Blob Storage│
│ (with RLS)       │ (Node.js v4)   │ (Auth + File Storage)            │
└────────┬─────────┴────────┬───────┴──────────────┬───────────────────┘
         │                  │                       │
         ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      External Services                               │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   Resend        │   Twilio        │   Stripe                         │
│   (Email)       │   (SMS/WhatsApp)│   (Billing)                      │
└─────────────────┴─────────────────┴─────────────────────────────────┘
```

## Component Layers

### 1. Presentation Layer (`src/components/`)

Organized by user role:

| Directory | Purpose |
|-----------|---------|
| `admin/` | Admin dashboard, user management, analytics, security |
| `clinician/` | Patient roster, adherence monitoring, e-prescribing |
| `patient/` | Medication management, schedules, symptoms, caregivers |
| `pharmacist/` | Prescriptions, inventory, controlled substances |
| `landing/` | Public marketing pages, auth modals |
| `shared/` | Cross-role components (help pages, warnings) |
| `ui/` | Base design system (shadcn/ui components) |
| `a11y/` | Accessibility components (FocusTrap, KeyboardNav, LiveRegion, SkipLink) |

### 2. State Management Layer

**React Query** for server state:
- Caching with stale-while-revalidate
- Optimistic updates for instant feedback
- Background refetching for freshness

**React Context** for app state:
- `AzureAuthContext` - Azure AD B2C authentication and user session (MSAL.js)
- `OrganizationContext` - Multi-tenant organization data
- `LanguageContext` - i18n translations (en, fr, ha, ig, yo)

### 3. Data Access Layer (`src/hooks/`)

Custom hooks abstract data fetching through the Express API:

```typescript
// Server data hooks
useCachedMedications()    // Medications with offline cache
useCachedTodaysSchedule() // Today's doses with cache
usePrescriptions()        // Prescription management
useNotificationSettings() // User notification preferences

// Auth/Security hooks
useAuthState()            // Current auth state (Azure AD B2C)
useAuthActions()          // Login/logout/register (MSAL.js)
useBiometricAuth()        // Native biometric
useTrustedDevices()       // Device trust management

// Offline hooks
useOfflineSync()          // Sync coordination
useOfflineStatus()        // Online/offline detection
```

### 4. Cache Layer (`src/lib/cache/`)

IndexedDB-based caching for offline support:

```
┌─────────────────────────────────────────┐
│           Cache Manager                  │
├─────────────────────────────────────────┤
│  medicationCache   │ Medication data    │
│  scheduleCache     │ Today's schedule   │
│  symptomCache      │ Symptom entries    │
└─────────────────────────────────────────┘
```

**Cache Strategy:**
1. Read from cache first (instant UI)
2. Fetch from network in background
3. Update cache with fresh data
4. Sync offline changes when online

### 5. API Layer (`api/`)

Express.js API deployed on Azure App Service, acting as a secure middleware between the frontend and Azure PostgreSQL:

```
api/
├── src/
│   ├── index.js          # Main Express server
│   └── logger.js         # Pino structured logger
├── openapi.yaml          # OpenAPI 3.0.3 specification
└── package.json
```

**Middleware Pipeline:**
1. Helmet (security headers)
2. pino-http (structured request logging with correlation IDs)
3. CORS (origin whitelist)
4. Rate limiting (global: 200/min, strict: 30/min, per-user: 120/min)
5. Auth middleware (Azure AD B2C JWT verification via passport-azure-ad)
6. Zod request body validation (profiles, medications, appointments, etc.)

**API Endpoints:**
- `GET/POST/PATCH/DELETE /rest/:table` - RESTful CRUD with PostgREST-compatible query syntax
- `POST /rpc/:function` - Remote procedure calls (device trust, security events, login tracking)
- `PUT/DELETE /storage/:bucket/:path` - Azure Blob Storage proxy with ownership enforcement
- `GET /health/ready` - Readiness probe (DB connectivity, pool stats)
- `GET /health/live` - Liveness probe
- `GET /docs` - Swagger UI (OpenAPI spec)

### 6. Azure Functions (`functions/`)

Timer-triggered and HTTP-triggered serverless functions:

```
functions/
├── src/
│   └── scheduled-jobs.js    # All timer-triggered functions
├── shared/
│   └── logger.js            # Structured JSON logger
├── stripe-webhook/          # Stripe event handler
├── send-medication-reminders/  # HTTP-triggered reminders
└── host.json
```

**Scheduled Jobs:**
- Medication reminders, appointment reminders, missed dose checks
- Medication expiry, refill alerts, polypharmacy checks
- Red flag symptom monitoring, license renewals
- Engagement scores, patient risk calculation
- Audit log cleanup, daily digest, notification retries
- Materialized view refresh

## Data Flow Patterns

### Authentication Flow

```
User → Login Page → Azure AD B2C (MSAL.js) → JWT Token → AzureAuthContext
                                                    ↓
                                             Bearer Token
                                                    ↓
                                  Express API (passport-azure-ad validation)
                                                    ↓
                                             secureQuery() with SET LOCAL app.current_user_id
                                                    ↓
                                          PostgreSQL (RLS enforced)
```

### Medication Reminder Flow

```
1. Azure Functions timer triggers send-medication-reminders
2. Query upcoming doses (next 30 minutes)
3. Group by user, check preferences
4. Filter quiet hours
5. Send via enabled channels:
   - Email (Resend)
   - SMS (Twilio)
   - WhatsApp (Twilio)
   - Web Push
   - Native Push (APNS/FCM)
6. Log to notification_history
```

### Offline Sync Flow

```
┌─────────────────────────────────────────┐
│              OFFLINE                     │
│  Action → Offline Queue (IndexedDB)      │
│              │                           │
│              ▼                           │
│  Cache Update (optimistic)               │
└─────────────────────────────────────────┘
              │ Network Restored
              ▼
┌─────────────────────────────────────────┐
│              ONLINE                      │
│  Sync Manager → Process Queue            │
│              │                           │
│              ▼                           │
│  Conflict Detection                      │
│    - Auto-resolve (newer wins)           │
│    - Manual resolution (user choice)     │
│              │                           │
│              ▼                           │
│  Server Update → Cache Invalidation      │
└─────────────────────────────────────────┘
```

## Multi-Tenancy

Organizations are the top-level tenant:

```
Organization
    ├── Members (users with roles)
    ├── Branding (colors, logos)
    ├── Subscription (Stripe)
    └── Settings
```

**Organization Roles:**
- `owner` - Full administrative access
- `admin` - User and settings management
- `member` - Standard access

**App Roles (cross-organization):**
- `admin` - Platform administrator
- `manager` - Department/team manager
- `clinician` - Healthcare provider
- `pharmacist` - Pharmacy staff
- `patient` - End user

## Security Architecture

### Row Level Security (RLS)

Every table has RLS policies enforced at the PostgreSQL level:

```sql
-- Example: Patients see only their own medications
CREATE POLICY "Users can view their own medications"
ON medications FOR SELECT
USING (current_setting('app.current_user_id')::uuid = user_id);
```

The Express API sets `app.current_user_id` via `SET LOCAL` before every query, ensuring RLS policies apply even through the API layer.

### Authentication Layers

1. **Azure AD B2C** - JWT-based authentication via MSAL.js (frontend) and passport-azure-ad (API)
2. **MFA** - TOTP with recovery codes
3. **Trusted Devices** - Skip MFA for verified devices
4. **Session Management** - Concurrent session limits
5. **Account Lockout** - Failed login protection

### API Security

1. **Helmet** - Standard security headers (CSP, HSTS, X-Frame-Options)
2. **Rate Limiting** - Three tiers: global, strict (RPC), per-user
3. **Input Validation** - Zod schemas for request bodies, column-name validation fallback
4. **Storage Security** - Bucket whitelist, path traversal protection, ownership enforcement, file type validation
5. **Error Sanitization** - `safeError()` strips internal details in production
6. **Global Error Handler** - Catches unhandled errors, prevents stack trace leakage

### Audit Trail

Sensitive operations are logged:

```sql
-- audit_log table captures:
- action (CREATE, UPDATE, DELETE)
- target_table
- target_id
- user_id
- ip_address
- user_agent
- details (JSON diff)
```

## Observability

### Structured Logging

- **API**: Pino with pino-http for structured JSON logging, correlation IDs (`x-request-id`), and sensitive field redaction
- **Azure Functions**: Custom JSON logger (`functions/shared/logger.js`) with function name, invocation ID, and structured data
- **Log Levels**: Dynamic per request (error for 5xx, warn for 4xx, info for success)

### Error Monitoring

- **Sentry** - Error tracking with source maps, session replay (10% normal, 100% on error), performance monitoring (10% sample rate)
- **SentryErrorBoundary** - React error boundary wrapping the entire app

### Health Checks

- `GET /health/ready` - Database connectivity, pool stats, latency
- `GET /health/live` - Process liveness (always 200)

## Performance Optimizations

1. **Code Splitting** - Lazy-loaded routes via React.lazy()
2. **Vendor Chunk Splitting** - Separate chunks for React, UI libs, charts, forms, motion, date-fns
3. **Bundle Size Budget** - 400 kB gzip limit via size-limit, 400 kB chunk warning in Vite
4. **Query Caching** - React Query with intelligent invalidation
5. **IndexedDB Caching** - Offline-first data access
6. **Connection Pooling** - PostgreSQL connection pool with configurable max

## CI/CD

- **GitHub Actions** - Automated build, test, and deploy on push to main
- **Deployment Slots** - Deploy to staging slot, health check, swap to production
- **Migration Tracking** - Idempotent migrations via `schema_migrations` table
- **Rollback** - One-click slot swap via `rollback.yml` workflow
- **Test Gating** - Unit tests and API tests must pass before deployment
- **Environment Protection** - GitHub Environment with required reviewers for production
