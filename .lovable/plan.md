
# Code Quality Improvements Implementation Plan

## Executive Summary
This plan implements the 5-phase code quality improvement roadmap from the uploaded document, focusing on: expanded test coverage, E2E testing with Playwright, edge function refactoring, ESLint strengthening, and comprehensive documentation.

---

## Current State Analysis

| Area | Current Status |
|------|----------------|
| **Unit Tests** | 7 test files covering auth, cache, and org hooks |
| **Coverage Thresholds** | Not configured in vitest.config.ts |
| **E2E Tests** | Not implemented (no Playwright) |
| **Edge Functions** | `send-medication-reminders` is 516 lines with duplicated patterns |
| **Shared Modules** | 4 files in `_shared/`: cors, rateLimiter, sentry, validation |
| **ESLint** | `@typescript-eslint/no-unused-vars` is currently OFF |
| **README** | Generic Lovable template, not project-specific |
| **Architecture Docs** | No `docs/` directory exists |

---

## Phase 1: Strengthen Testing Foundation

### 1.1 New Unit Test Files

The following test files will be created:

```text
src/test/
├── hooks/
│   ├── useCachedMedications.test.ts
│   ├── useCachedTodaysSchedule.test.ts
│   ├── useOfflineSync.test.ts
│   └── useUnifiedPushNotifications.test.ts
├── lib/
│   ├── offlineQueue.test.ts
│   └── conflictResolution.test.ts
└── components/
    └── patient/
        ├── MedicationsPage.test.tsx
        └── AddMedicationDialog.test.tsx
```

**Test Coverage Focus Areas:**

| Module | Key Test Scenarios |
|--------|-------------------|
| `useCachedMedications` | Cache-first loading, network fallback, cache invalidation, offline behavior |
| `useCachedTodaysSchedule` | Schedule retrieval, date filtering, cache freshness |
| `useOfflineSync` | Online/offline detection, sync triggering, conflict handling |
| `offlineQueue` | Add/remove actions, IndexedDB operations, sync flow, conflict detection |
| `conflictResolution` | Auto-resolution logic, merge strategies, conflict creation/resolution |
| `MedicationsPage` | Render medications list, loading states, empty states |
| `AddMedicationDialog` | Form validation, drug interaction warnings, submit handling |

### 1.2 Coverage Thresholds

Update `vitest.config.ts` to add threshold enforcement:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  exclude: [/* existing */],
  thresholds: {
    statements: 40,
    branches: 35,
    functions: 40,
    lines: 40,
  },
},
```

---

## Phase 2: E2E Testing with Playwright

### 2.1 Configuration Files

Create new Playwright configuration:

```text
e2e/
├── playwright.config.ts
├── fixtures/
│   └── auth.ts          # Login/signup helpers
└── tests/
    ├── auth.spec.ts
    ├── medication-management.spec.ts
    ├── schedule.spec.ts
    └── offline-sync.spec.ts
```

**playwright.config.ts highlights:**
- Base URL: Local dev server
- Browsers: Chromium, Firefox, WebKit
- Screenshots on failure
- Video recording for debugging
- 30-second timeout for network operations

### 2.2 Critical User Journeys

| Journey | Test Scenarios |
|---------|---------------|
| **Authentication** | Sign up validation, sign in with valid/invalid credentials, password reset, session timeout |
| **Medication Management** | Add medication with validation, view schedule, mark dose taken/missed, edit details |
| **Offline Behavior** | Create log while offline, verify sync on reconnection, conflict resolution UI |

### 2.3 CI Integration

Update `.github/workflows/bump-version.yml` or create new workflow:

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
    - name: Install dependencies
      run: npm ci
    - name: Run unit tests
      run: npm test -- --coverage
    - name: Install Playwright
      run: npx playwright install --with-deps
    - name: Run E2E tests
      run: npm run test:e2e
    - name: Upload test artifacts
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: e2e/playwright-report/
```

**New package.json scripts:**
- `"test:e2e": "playwright test"`
- `"test:e2e:ui": "playwright test --ui"`

---

## Phase 3: Refactor Large Edge Functions

### 3.1 Shared Module Extraction

Create reusable modules in `supabase/functions/_shared/`:

```text
supabase/functions/_shared/
├── cors.ts (existing)
├── rateLimiter.ts (existing)
├── sentry.ts (existing)
├── validation.ts (existing)
├── email/
│   ├── sendEmail.ts              # Resend API wrapper
│   ├── escapeHtml.ts             # XSS protection
│   └── templates/
│       └── medicationReminder.ts # Email HTML template
├── notifications/
│   ├── checkQuietHours.ts        # Quiet hours logic
│   └── getUserPreferences.ts     # Fetch user notification prefs
└── medications/
    └── fetchUpcomingDoses.ts     # Query upcoming doses
```

### 3.2 Extraction Details

**sendEmail.ts** - Extract from lines 19-41 of send-medication-reminders:
- Resend API integration
- Error handling
- Return email ID for tracking

**checkQuietHours.ts** - Extract from lines 74-90:
- Time comparison logic
- Overnight quiet hours handling

**getUserPreferences.ts** - Extract preference fetching pattern:
- Batch user preference lookup
- Default value handling

**medicationReminder.ts template** - Extract HTML template (lines 278-326):
- Parameterized template
- XSS-safe rendering

### 3.3 Refactored send-medication-reminders

After extraction, the main function will:
1. Import shared modules
2. Focus on orchestration logic
3. Target: Under 200 lines

---

## Phase 4: Strengthen ESLint Configuration

### 4.1 Updated Rules

Modify `eslint.config.js`:

```javascript
rules: {
  ...reactHooks.configs.recommended.rules,
  "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  // Enable unused vars checking with smart exceptions
  "@typescript-eslint/no-unused-vars": ["warn", {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrorsIgnorePattern: "^_",
  }],
  // Additional quality rules
  "@typescript-eslint/no-explicit-any": "warn",
  "prefer-const": "warn",
},
```

### 4.2 Fix Strategy

1. Run `npm run lint` to identify violations
2. For intentional exceptions: Add `// eslint-disable-next-line` with justification
3. Fix genuine issues incrementally
4. CI will fail on errors (not warnings initially)

---

## Phase 5: Documentation

### 5.1 README.md Overhaul

Replace generic template with:

```markdown
# Pillaxia Companion

Healthcare medication management platform with multi-role support for patients, 
clinicians, pharmacists, and administrators.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Lovable Cloud (PostgreSQL, Auth, Edge Functions)
- **Mobile**: Capacitor (iOS/Android)

## Getting Started
[Development setup instructions]

## Testing
- Unit: `npm test`
- E2E: `npm run test:e2e`
- Coverage: `npm run test:coverage`

## Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Database Schema
See [docs/DATABASE.md](docs/DATABASE.md)
```

### 5.2 Architecture Documentation

Create `docs/ARCHITECTURE.md`:

- System overview diagram
- Component layers (Client, State, Backend, External)
- Data flow patterns
- Offline-first architecture
- Multi-channel notification system

### 5.3 Database Documentation

Create `docs/DATABASE.md`:

- Core tables and relationships
- Role-based access patterns (RLS policies overview)
- Key constraints and triggers
- Migration conventions

---

## Implementation Timeline

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| **Phase 1** | Core hook tests, offline sync tests, component tests | 4-5 sessions |
| **Phase 2** | Playwright setup, auth E2E, medication E2E | 3-4 sessions |
| **Phase 3** | Extract shared modules, refactor edge functions | 2-3 sessions |
| **Phase 4** | Update ESLint, fix violations | 1-2 sessions |
| **Phase 5** | README, Architecture docs, Database docs | 2-3 sessions |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Unit test coverage | 40% minimum (incrementally increase to 70%) |
| E2E tests | Cover 5 critical user journeys |
| ESLint | Zero errors on `npm run lint` |
| Documentation | README, ARCHITECTURE.md, DATABASE.md complete |
| Edge functions | No function exceeds 200 lines |

---

## Technical Notes

### Test Utilities
The existing `src/test/test-utils.tsx` provides custom render with providers. All new tests will use this utility for consistency.

### Mocking Strategy
- **Supabase**: Mock via vi.mock with typed responses
- **IndexedDB**: Use fake-indexeddb or manual mocks (pattern exists in cacheManager.test.ts)
- **Capacitor**: Mock platform detection for push notification tests

### Edge Function Testing
Edge functions will be tested via the existing `supabase--test-edge-functions` tool after refactoring.

### Dependencies to Add
- `@playwright/test` (dev dependency)
- `fake-indexeddb` (dev dependency, if needed for more robust IDB mocking)
