# Production Readiness Improvements Plan

**Current Score:** 8.5/10  
**Target Score:** 9.0/10  
**Status:** Not Started

---

## Phase 1: Critical Fixes (P1) - Required Before Production

### 1.1 Add Test Scripts to package.json
- **Effort:** 5 minutes
- **Status:** ⬜ Not Started
- **Notes:** Add `test`, `test:watch`, `test:coverage`, `test:e2e`, `test:e2e:ui`, `lint:fix` scripts

### 1.2 Fix ESLint Errors (16 errors)
- **Effort:** 30 minutes
- **Status:** ⬜ Not Started
- **Files:**
  - `tailwind.config.ts` - Convert `require()` to ESM import
  - `android/app/build/.../native-bridge.js` - Exclude from lint
  - Various edge functions - Add proper type definitions

### 1.3 Fix TypeScript `any` Types in Auth Paths
- **Effort:** 1 hour
- **Status:** ⬜ Not Started
- **Files:**
  - `src/contexts/AuthContext.tsx`
  - `src/hooks/useAuthActions.ts`
  - `src/hooks/useAuthState.ts`
- **Pattern:** Use proper return types with `.returns<T>()` on Supabase queries

### 1.4 Fix TypeScript `any` Types in Medication Handling
- **Effort:** 1 hour
- **Status:** ⬜ Not Started
- **Files:**
  - `src/hooks/useCachedMedications.ts`
  - `src/hooks/useCachedTodaysSchedule.ts`
  - `src/components/patient/MedicationsPage.tsx`
- **Pattern:** Use Supabase generated types from `src/integrations/supabase/types.ts`

### 1.5 Fix TypeScript `any` Types in Offline Sync
- **Effort:** 45 minutes
- **Status:** ⬜ Not Started
- **Files:**
  - `src/lib/offlineQueue.ts`
  - `src/lib/conflictResolution.ts`
  - `src/lib/cache/cacheManager.ts`
- **Pattern:** Type action bodies with union types, use `Record<string, unknown>` instead of `any`

---

## Phase 2: Recommended Improvements (P2)

### 2.1 Reduce Console Warnings in Edge Functions
- **Effort:** 30 minutes
- **Status:** ⬜ Not Started
- **Files:** 50+ edge functions in `supabase/functions/`
- **Pattern:** Replace `console.log` with `console.info` (allowed by lint config)

### 2.2 Fix Unused Variable Warnings
- **Effort:** 30 minutes
- **Status:** ⬜ Not Started
- **Patterns:**
  - Prefix unused vars with underscore: `error` → `_error`
  - Remove unused imports
  - Use rest destructuring: `{ unusedProp: _, ...rest }`

---

## Phase 3: Housekeeping (P3)

### 3.1 Clean Up Duplicate Directories
- **Effort:** 15 minutes
- **Status:** ⬜ Not Started
- **Action:** Review and archive/remove old version directories if present

---

## Implementation Schedule

| Day | Tasks | Est. Time |
|-----|-------|-----------|
| 1 | 1.1, 1.2, 1.3, 1.4 | 2-3 hours |
| 2 | 1.5, 2.1, 2.2 | 1.5 hours |
| 3 | 3.1, Verification | 15 min |

---

## Expected Outcomes

| Category | Before | After | Change |
|----------|--------|-------|--------|
| TypeScript Usage | 7.5 | 8.5+ | +1.0 |
| Code Style & Linting | 7.0 | 8.0+ | +1.0 |
| Lint Errors | 16 | 0 | -16 |
| Lint Warnings | 1386 | ~200 | -1186 |
| Overall Score | 8.5 | 9.0 | +0.5 |

---

## Verification Commands

```bash
# Verify tests pass
npm test

# Verify no lint errors
npm run lint

# Check coverage meets thresholds
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

---

## Detailed Technical Fixes

### TypeScript Fix Patterns

#### Auth Paths (1.3)
```typescript
// Before
const fetchRoles = async (userId: string) => {
  const { data, error } = await supabase.from("user_roles").select("role")...
  return data.map((r) => r.role as AppRole); // data could be any
};

// After
interface UserRoleRow {
  role: AppRole;
}
const fetchRoles = async (userId: string): Promise<AppRole[]> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .returns<UserRoleRow[]>();
  if (error || !data) return [];
  return data.map((r) => r.role);
};
```

#### Medication Handling (1.4)
```typescript
import { Database } from "@/integrations/supabase/types";
type Medication = Database["public"]["Tables"]["medications"]["Row"];
type MedicationLog = Database["public"]["Tables"]["medication_logs"]["Row"];
```

#### Offline Sync (1.5)
```typescript
// offlineQueue.ts - Type the body parameter
interface PendingAction {
  type: "medication_log" | "symptom_entry" | "message";
  body: MedicationLogPayload | SymptomEntryPayload | MessagePayload;
}

// conflictResolution.ts - Type conflict data
interface ConflictData {
  localData: Record<string, unknown>;
  serverData: Record<string, unknown> | null;
}
```

### ESLint Fix (1.2)
```typescript
// tailwind.config.ts
// Before
require("tailwindcss-animate")

// After
import tailwindcssAnimate from "tailwindcss-animate"
```
