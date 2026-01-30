
# Code Quality & Testing Readiness Plan

This plan addresses the critical testing gaps identified in the code quality review to bring the testing score from 7.5 to the 8.5 production threshold.

---

## Summary of Issues

| Issue | Current State | Required Action |
|-------|--------------|-----------------|
| Test Scripts | Missing from package.json | Add 4 test scripts |
| Failing Tests | 7 tests failing (mock issues) | Fix mock configuration |
| Coverage Thresholds | Not configured | Add 60%+ thresholds for critical paths |
| Test Files | Some planned tests missing | Create missing test files |
| E2E Staging | Not configured | Verify staging environment |

---

## Task 1: Add Test Scripts to package.json

Add the following scripts to `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test"
}
```

---

## Task 2: Fix Failing Unit Tests

The 7 failing tests are caused by mock configuration issues in the Auth tests. The problems are:

1. **Supabase mock conflicts** - `src/test/setup.ts` provides a global mock, but `Auth.test.tsx` defines its own partial mock, causing conflicts
2. **RPC mock missing** - The global setup mock doesn't include `rpc` method needed for account lockout checks
3. **AuthProvider dependencies** - The Auth tests wrap with AuthProvider but mocks don't fully support the context's needs

**Fixes Required:**

### 2.1 Update `src/test/setup.ts`
- Add `rpc` method to the Supabase mock
- Ensure mock structure matches all test needs

### 2.2 Update `src/test/Auth.test.tsx`
- Remove duplicate Supabase mock definition
- Use consistent mock patterns with setup.ts
- Fix AuthError mock usage

### 2.3 Update `src/test/useAuth.test.tsx`
- Align mock structure with global setup
- Fix subscription mock typing

---

## Task 3: Add Coverage Thresholds

Update `vitest.config.ts` to enforce coverage requirements:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html"],
  exclude: [
    "node_modules/",
    "src/test/",
    "**/*.d.ts",
    "src/integrations/supabase/types.ts",
    "e2e/",
  ],
  thresholds: {
    statements: 40,
    branches: 35,
    functions: 40,
    lines: 40,
  },
},
```

**Note:** Starting at 40% to avoid breaking builds, then incrementally increase to 60%+ for critical paths.

---

## Task 4: Create Missing Test Files

The plan.md references test files that don't exist. Create them:

### 4.1 Hooks Tests (`src/test/hooks/`)

| File | Test Coverage |
|------|--------------|
| `useCachedMedications.test.ts` | Cache-first loading, network fallback, offline behavior |
| `useCachedTodaysSchedule.test.ts` | Schedule retrieval, date filtering, cache freshness |
| `useOfflineSync.test.ts` | Online/offline detection, sync triggering, queue processing |

### 4.2 Library Tests (`src/test/lib/`)

| File | Test Coverage |
|------|--------------|
| `offlineQueue.test.ts` | Add/remove actions, IndexedDB operations, sync flow |
| `conflictResolution.test.ts` | Auto-resolution logic, merge strategies |

Each test file will follow the existing patterns in `cacheManager.test.ts` for mocking IndexedDB and Supabase.

---

## Task 5: Staging Environment Setup ✅ COMPLETED

The staging environment is now configured:

### 5.1 E2E Test Users (in `seed-demo-users` edge function)
- `e2e-test@pillaxia.test` (patient) - password: `TestPassword123!`
- `e2e-clinician@pillaxia.test` (clinician) - password: `ClinicianPass123!`
- `e2e-pharmacist@pillaxia.test` (pharmacist) - password: `PharmacistPass123!`
- `e2e-admin@pillaxia.test` (admin) - password: `AdminPass123!`

### 5.2 Environment Detection
- `src/lib/environment.ts` - Auto-detects staging/production/development
- `src/components/EnvironmentBanner.tsx` - Visual indicator in non-production

### 5.3 CI Configuration
- `.github/workflows/e2e-tests.yml` - Supports `staging` and `local` environments
- `e2e/fixtures/auth.ts` - Uses env vars with fallback defaults
- `e2e/playwright.config.ts` - Conditional webServer for local testing

### 5.4 GitHub Secrets Required
Set these in your GitHub repository settings:
- `STAGING_URL` → `https://id-preview--8333c041-bf59-48ac-a717-3597c3a11358.lovable.app`
- `E2E_TEST_USER_EMAIL` → `e2e-test@pillaxia.test`
- `E2E_TEST_USER_PASSWORD` → `TestPassword123!`
- `E2E_CLINICIAN_EMAIL` → `e2e-clinician@pillaxia.test`
- `E2E_CLINICIAN_PASSWORD` → `ClinicianPass123!`

### 5.5 Seeding Test Users
To create the E2E test users, an admin must call the `seed-demo-users` edge function.
This can be done via the admin dashboard or by invoking the function directly.

---

## Implementation Order

```text
1. Add test scripts to package.json
   │
2. Fix global mock setup (src/test/setup.ts)
   │
3. Fix Auth.test.tsx mock conflicts
   │
4. Fix useAuth.test.tsx mock conflicts  
   │
5. Add coverage thresholds to vitest.config.ts
   │
6. Create missing hook tests (3 files)
   │
7. Create missing lib tests (2 files)
   │
8. Verify E2E staging configuration
   │
9. Run full test suite and validate
```

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Test Failures | 7 | 0 |
| Test Scripts | 0 | 4 |
| Coverage Thresholds | None | 40% minimum |
| New Unit Tests | 0 | ~60 tests |
| Testing Score | 7.5 | 8.5+ |

---

## Files to Create/Modify

### New Files (5)
- `src/test/hooks/useCachedMedications.test.ts`
- `src/test/hooks/useCachedTodaysSchedule.test.ts`
- `src/test/hooks/useOfflineSync.test.ts`
- `src/test/lib/offlineQueue.test.ts`
- `src/test/lib/conflictResolution.test.ts`

### Modified Files (5)
- `package.json` - Add test scripts
- `vitest.config.ts` - Add coverage thresholds
- `src/test/setup.ts` - Fix global mocks
- `src/test/Auth.test.tsx` - Fix mock conflicts
- `src/test/useAuth.test.tsx` - Fix mock conflicts

---

## Technical Details

### Mock Structure Fix

The global Supabase mock in `setup.ts` needs these additions:

```typescript
supabase: {
  auth: { /* existing */ },
  from: vi.fn(() => ({ /* existing */ })),
  rpc: vi.fn().mockResolvedValue({ data: { locked: false }, error: null }),
  functions: { invoke: vi.fn() },
  channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
}
```

### Test Pattern for Hooks

```typescript
// Example pattern for useCachedMedications.test.ts
describe("useCachedMedications", () => {
  it("loads from cache first for instant display", async () => {
    // Setup: Mock medicationCache.getMedications
    // Act: Render hook
    // Assert: Medications loaded from cache immediately
  });

  it("fetches from network when online", async () => {
    // Setup: Mock online status + network response
    // Act: Render hook
    // Assert: Fresh data fetched and cached
  });

  it("returns cached data when offline", async () => {
    // Setup: Mock offline status
    // Act: Render hook
    // Assert: Only cache data used
  });
});
```
