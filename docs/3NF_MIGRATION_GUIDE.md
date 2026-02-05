# 3NF Compliance Migration Guide

This guide documents the changes made to the database schema for Third Normal Form (3NF) compliance and how to update your application code.

## Overview

The database has been normalized to comply with 3NF, removing redundant data and transitive dependencies. Read-optimized materialized views have been created to maintain query performance without denormalizing the OLTP schema.

## Schema Changes Summary

### Tables Modified

1. **profiles** - Removed `email` and `organization` TEXT columns
2. **medications** - Added FK columns, removed `prescriber` and `pharmacy` TEXT columns
3. **patient_vitals** - Removed `bmi` derived column
4. **medication_availability** - Added `medication_catalog_id` FK, removed medication detail TEXT columns
5. **controlled_drug_dispensing** - Added FK columns, removed TEXT name columns
6. **drug_transfers** - Added `medication_catalog_id` FK, removed medication detail TEXT columns
7. **organization_invoices** - Removed `stripe_customer_id` duplicate column
8. **medication_schedules** - Removed redundant `user_id` column

### New Tables

- **medication_catalog** - Normalized medication reference table

### New Views

- **profiles_with_email** - Backward compatibility view for profiles with email
- **medications_with_details** - Medications with prescriber/pharmacy names
- **patient_vitals_with_bmi** - Vitals with computed BMI
- **medication_availability_with_details** - Availability with medication details
- **controlled_drug_dispensing_full** - Full dispensing details with names
- **drug_transfers_full** - Transfers with medication details
- **organization_invoices_full** - Invoices with stripe_customer_id
- **medication_schedules_with_user** - Schedules with user_id

### New Materialized Views (Read-Optimized)

- **medication_availability_view**
- **patient_vitals_with_bmi_view**
- **medications_full_view**
- **controlled_drug_dispensing_full_view**
- **drug_transfers_full_view**
- **organization_invoices_full_view**

## Code Updates Required

### 1. Profiles Table - Email Access

**Before:**
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("first_name, last_name, email")
  .eq("user_id", userId)
  .single();
```

**After (Option 1 - Use view):**
```typescript
const { data: profile } = await supabase
  .from("profiles_with_email")
  .select("first_name, last_name, email")
  .eq("user_id", userId)
  .single();
```

**After (Option 2 - Join with auth.users):**
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select(`
    first_name,
    last_name,
    auth.users!inner(email)
  `)
  .eq("user_id", userId)
  .single();
```

**Files to update:**
- `src/components/patient/CaregiverDashboardContent.tsx` (line 99)
- `src/components/clinician/PatientRosterPage.tsx` (line 144)

### 2. Medications Table - Prescriber and Pharmacy

**Before:**
```typescript
const { data: medications } = await supabase
  .from("medications")
  .select("id, name, prescriber, pharmacy")
  .eq("user_id", userId);
```

**After (Option 1 - Use view):**
```typescript
const { data: medications } = await supabase
  .from("medications_with_details")
  .select("id, name, prescriber, pharmacy")
  .eq("user_id", userId);
```

**After (Option 2 - Use materialized view for reads):**
```typescript
const { data: medications } = await supabase
  .from("medications_full_view")
  .select("id, name, prescriber_name, pharmacy_name")
  .eq("user_id", userId);
```

**After (Option 3 - Join manually):**
```typescript
const { data: medications } = await supabase
  .from("medications")
  .select(`
    id,
    name,
    prescriber_user_id,
    pharmacy_id,
    profiles!medications_prescriber_user_id_fkey(first_name, last_name),
    pharmacy_locations(name)
  `)
  .eq("user_id", userId);
```

**Files to update:**
- `src/components/pharmacist/RefillRequestsPage.tsx` (line 404)
- `src/components/pharmacist/PrescriptionsPage.tsx` (line 265, 300)
- `src/components/patient/RequestRefillDialog.tsx` (line 106)
- `src/components/patient/PrescriptionStatusCard.tsx` (line 118)
- `src/components/patient/MedicationsPage.tsx` (line 144)
- `src/components/clinician/MedicationReviewPage.tsx` (line 101-102, 287-288)

### 3. Patient Vitals - BMI Access

**Before:**
```typescript
const { data: vitals } = await supabase
  .from("patient_vitals")
  .select("weight, height, bmi")
  .eq("user_id", userId);
```

**After (Use view):**
```typescript
const { data: vitals } = await supabase
  .from("patient_vitals_with_bmi")
  .select("weight, height, bmi")
  .eq("user_id", userId);
```

**Or use materialized view for better performance:**
```typescript
const { data: vitals } = await supabase
  .from("patient_vitals_with_bmi_view")
  .select("weight, height, bmi, patient_name")
  .eq("user_id", userId);
```

**Files to update:**
- `src/hooks/usePatientCDSData.ts` (line 78) - if BMI is needed

### 4. Medication Schedules - User ID Access

**Before:**
```typescript
const { data: schedules } = await supabase
  .from("medication_schedules")
  .select("id, user_id, time_of_day")
  .eq("user_id", userId);
```

**After (Use view):**
```typescript
const { data: schedules } = await supabase
  .from("medication_schedules_with_user")
  .select("id, user_id, time_of_day")
  .eq("user_id", userId);
```

**After (Derive from medications):**
```typescript
const { data: schedules } = await supabase
  .from("medication_schedules")
  .select(`
    id,
    time_of_day,
    medications!inner(user_id)
  `)
  .eq("medications.user_id", userId);
```

**Files to update:**
- Any queries filtering medication_schedules by user_id directly

### 5. Medication Availability - Medication Details

**Before:**
```typescript
const { data: availability } = await supabase
  .from("medication_availability")
  .select("medication_name, generic_name, dosage, form, is_available")
  .eq("pharmacy_id", pharmacyId);
```

**After (Use view):**
```typescript
const { data: availability } = await supabase
  .from("medication_availability_with_details")
  .select("medication_name, generic_name, dosage, form, is_available")
  .eq("pharmacy_id", pharmacyId);
```

**Or use materialized view:**
```typescript
const { data: availability } = await supabase
  .from("medication_availability_view")
  .select("medication_name, generic_name, dosage, form, is_available, pharmacy_name")
  .eq("pharmacy_id", pharmacyId);
```

### 6. Controlled Drug Dispensing - Patient/Prescriber Names

**Before:**
```typescript
const { data: dispensing } = await supabase
  .from("controlled_drug_dispensing")
  .select("patient_name, prescriber_name, prescription_number")
  .eq("controlled_drug_id", drugId);
```

**After (Use view):**
```typescript
const { data: dispensing } = await supabase
  .from("controlled_drug_dispensing_full")
  .select("patient_name, prescriber_name, prescription_number")
  .eq("controlled_drug_id", drugId);
```

**Or use materialized view:**
```typescript
const { data: dispensing } = await supabase
  .from("controlled_drug_dispensing_full_view")
  .select("patient_name, prescriber_name, prescription_number, controlled_drug_name")
  .eq("controlled_drug_id", drugId);
```

**Files to update:**
- `src/components/pharmacist/DispenseControlledDrugDialog.tsx` (line 99)
- `src/components/pharmacist/ControlledDrugRegisterPage.tsx` (line 404-405)

### 7. Organization Invoices - Stripe Customer ID

**Before:**
```typescript
const { data: invoices } = await supabase
  .from("organization_invoices")
  .select("id, stripe_customer_id, amount_due")
  .eq("organization_id", orgId);
```

**After (Use view):**
```typescript
const { data: invoices } = await supabase
  .from("organization_invoices_full")
  .select("id, stripe_customer_id, amount_due")
  .eq("organization_id", orgId);
```

**Or use materialized view:**
```typescript
const { data: invoices } = await supabase
  .from("organization_invoices_full_view")
  .select("id, stripe_customer_id, amount_due, organization_name")
  .eq("organization_id", orgId);
```

## Materialized View Refresh

Materialized views need to be refreshed periodically. Use the provided function:

```sql
SELECT public.refresh_all_materialized_views();
```

**Recommended refresh schedule:**
- After bulk data updates
- Daily during low-traffic hours
- Before generating reports

## Migration Checklist

- [ ] Update all queries accessing `profiles.email`
- [ ] Update all queries accessing `medications.prescriber` or `medications.pharmacy`
- [ ] Update all queries accessing `patient_vitals.bmi`
- [ ] Update all queries filtering `medication_schedules` by `user_id`
- [ ] Update queries accessing medication details from `medication_availability`
- [ ] Update queries accessing names from `controlled_drug_dispensing`
- [ ] Update queries accessing `organization_invoices.stripe_customer_id`
- [ ] Test all affected features
- [ ] Set up materialized view refresh schedule
- [ ] Monitor query performance after migration

## Performance Considerations

1. **Use materialized views for read-heavy queries** - They're pre-computed and indexed
2. **Use regular views for write operations** - They always reflect current data
3. **Join with FK columns** - More efficient than TEXT matching
4. **Index usage** - All FK columns are indexed for optimal performance

## Rollback Strategy

If issues arise, the old TEXT columns are still present (commented out in migrations). To rollback:

1. Uncomment the DROP COLUMN statements in migrations
2. Restore the columns with data from views
3. Revert application code changes

## Support

For questions or issues with the migration, refer to the migration files in `supabase/migrations/` starting with `20260204`.
