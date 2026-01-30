# Architecture Overview

This document describes the high-level architecture of Pillaxia Companion, a medication adherence platform built with React, TypeScript, and Lovable Cloud (Supabase).

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
│                     Lovable Cloud (Supabase)                         │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   PostgreSQL    │  Edge Functions │  Auth + Storage                  │
│   (with RLS)    │  (Deno)         │                                  │
└────────┬────────┴────────┬────────┴─────────────┬───────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
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

### 2. State Management Layer

**React Query** for server state:
- Caching with stale-while-revalidate
- Optimistic updates for instant feedback
- Background refetching for freshness

**React Context** for app state:
- `AuthContext` - Authentication and user session
- `OrganizationContext` - Multi-tenant organization data
- `LanguageContext` - i18n translations

### 3. Data Access Layer (`src/hooks/`)

Custom hooks abstract data fetching:

```typescript
// Server data hooks
useCachedMedications()    // Medications with offline cache
useCachedTodaysSchedule() // Today's doses with cache
usePrescriptions()        // Prescription management
useNotificationSettings() // User notification preferences

// Auth/Security hooks
useAuthState()            // Current auth state
useAuthActions()          // Login/logout/register
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

### 5. Backend Layer (`supabase/functions/`)

Edge Functions organized by domain:

```
supabase/functions/
├── _shared/                    # Reusable modules
│   ├── cors.ts                 # CORS handling
│   ├── sentry.ts               # Error tracking
│   ├── rateLimiter.ts          # Rate limiting
│   ├── validation.ts           # Input validation
│   ├── email/                  # Email utilities
│   ├── notifications/          # Notification utilities
│   └── medications/            # Medication utilities
├── send-medication-reminders/  # Scheduled reminders
├── send-push-notification/     # Web push
├── send-native-push/           # iOS/Android push
├── send-sms-notification/      # Twilio SMS
├── send-whatsapp-notification/ # Twilio WhatsApp
├── clinical-decision-support/  # AI-assisted CDS
└── ...
```

## Data Flow Patterns

### Authentication Flow

```
User → Login Form → Supabase Auth → JWT Token → AuthContext
                                         ↓
                                  Session Storage
                                         ↓
                                  Protected Routes
```

### Medication Reminder Flow

```
1. Cron Job triggers send-medication-reminders
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

Every table has RLS policies:

```sql
-- Example: Patients see only their own medications
CREATE POLICY "Users can view their own medications"
ON medications FOR SELECT
USING (auth.uid() = user_id);
```

### Authentication Layers

1. **Supabase Auth** - JWT-based authentication
2. **MFA** - TOTP with recovery codes
3. **Trusted Devices** - Skip MFA for verified devices
4. **Session Management** - Concurrent session limits
5. **Account Lockout** - Failed login protection

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

## Performance Optimizations

1. **Code Splitting** - Lazy-loaded routes
2. **Image Optimization** - Responsive images with proper sizing
3. **Query Caching** - React Query with intelligent invalidation
4. **IndexedDB Caching** - Offline-first data access
5. **Edge Functions** - Serverless, globally distributed

## Monitoring & Observability

- **Sentry** - Error tracking and performance monitoring
- **Notification History** - Delivery tracking and analytics
- **Audit Logs** - Security event tracking
- **Analytics** - User engagement metrics
