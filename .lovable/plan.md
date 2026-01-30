# Production Readiness Improvements Plan

**Current Score:** 8.5/10  
**Target Score:** 9.0/10  
**Status:** In Progress

---

## Phase 1: Critical Fixes (P1) - Required Before Production

### 1.1 Add Test Scripts to package.json
- **Effort:** 5 minutes
- **Status:** ✅ Complete (scripts already exist)
- **Notes:** Test scripts already configured in package.json

### 1.2 Fix ESLint Errors (16 errors)
- **Effort:** 30 minutes
- **Status:** ✅ Complete
- **Changes Made:**
  - `tailwind.config.ts` - Converted `require("tailwindcss-animate")` to ESM import
  - `eslint.config.js` - Added `android`, `ios`, `capacitor` to ignores list

### 1.3 Fix TypeScript `any` Types in Auth Paths
- **Effort:** 1 hour
- **Status:** ✅ Complete
- **Changes Made:**
  - `src/contexts/AuthContext.tsx` - Import types from Supabase generated types
  - `src/hooks/useAuthState.ts` - Use `Database["public"]["Enums"]["app_role"]` for AppRole
  - Both files now use proper return type annotations for fetchRoles/fetchProfile

### 1.4 Fix TypeScript `any` Types in Medication Handling
- **Effort:** 1 hour
- **Status:** ✅ Already properly typed
- **Notes:** Files already use `Tables<"medications">` and proper interfaces

### 1.5 Fix TypeScript `any` Types in Offline Sync
- **Effort:** 45 minutes
- **Status:** ✅ Already properly typed
- **Notes:** Files use `unknown` instead of `any`, proper interfaces exported

---

## Phase 2: Recommended Improvements (P2)

### 2.1 Reduce Console Warnings in Edge Functions
- **Effort:** 30 minutes
- **Status:** ⬜ Pending (bulk operation)
- **Files:** 50+ edge functions in `supabase/functions/`
- **Pattern:** Replace `console.log` with `console.info` (allowed by lint config)
- **Command for bulk fix:**
  ```bash
  find supabase/functions -name "*.ts" -exec sed -i '' 's/console\.log/console.info/g' {} \;
  ```

### 2.2 Fix Unused Variable Warnings
- **Effort:** 30 minutes
- **Status:** ⬜ Pending (incremental)
- **Patterns:**
  - Prefix unused vars with underscore: `error` → `_error`
  - Remove unused imports
  - Use rest destructuring: `{ unusedProp: _, ...rest }`

---

## Phase 3: Housekeeping (P3)

### 3.1 Clean Up Duplicate Directories
- **Effort:** 15 minutes
- **Status:** ⬜ Not applicable (directories are outside project scope)
- **Notes:** External directories like `pillaxia-2/` are not part of this codebase

---

## Summary

| Task | Status |
|------|--------|
| 1.1 Test Scripts | ✅ Complete |
| 1.2 ESLint Errors | ✅ Complete |
| 1.3 Auth Types | ✅ Complete |
| 1.4 Medication Types | ✅ Already typed |
| 1.5 Offline Types | ✅ Already typed |
| 2.1 Console Warnings | ⬜ Bulk operation pending |
| 2.2 Unused Variables | ⬜ Incremental |
| 3.1 Directory Cleanup | ⬜ N/A |

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

## Key Changes Made

### tailwind.config.ts
```typescript
// Before
require("tailwindcss-animate")

// After
import tailwindcssAnimate from "tailwindcss-animate"
// ...
plugins: [tailwindcssAnimate],
```

### eslint.config.js
```javascript
// Added to ignores
{ ignores: ["dist", "node_modules", "e2e", "android", "ios", "capacitor"] },
```

### AuthContext.tsx & useAuthState.ts
```typescript
// Import Supabase types
import type { Database } from "@/integrations/supabase/types";

// Use generated enum type
type AppRole = Database["public"]["Enums"]["app_role"];

// Proper return type for fetchRoles
async function fetchRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  // data is properly typed, no cast needed
  return data.map((r) => r.role);
}
```
