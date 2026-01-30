# Database Schema

This document describes the database schema for Pillaxia Companion, including core tables, relationships, and Row Level Security (RLS) policies.

## Schema Overview

The database is organized into several functional domains:

- **User Management** - Profiles, roles, organizations
- **Medications** - Medications, schedules, logs
- **Notifications** - Preferences, history, settings
- **Security** - Login attempts, lockouts, trusted devices, MFA
- **Clinical** - Prescriptions, appointments, clinical data
- **Pharmacy** - Inventory, controlled substances, recalls

## Core Tables

### User Management

#### `profiles`
User profile information linked to auth.users.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Reference to auth.users (unique) |
| email | text | User email |
| first_name | text | First name |
| last_name | text | Last name |
| phone | text | Phone number |
| avatar_url | text | Profile image URL |
| timezone | text | User's timezone |
| language | text | Preferred language |

#### `user_roles`
Multi-role support for users.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| role | app_role | Enum: admin, manager, clinician, pharmacist, patient |

**App Role Enum:**
```sql
CREATE TYPE app_role AS ENUM (
  'admin', 'manager', 'clinician', 'pharmacist', 'patient'
);
```

#### `organizations`
Multi-tenant organization support.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Organization name |
| slug | text | URL-safe identifier |
| is_active | boolean | Active status |

#### `organization_members`
User-organization relationships.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Organization reference |
| user_id | uuid | User reference |
| org_role | organization_role | Enum: owner, admin, member |
| is_active | boolean | Membership status |

### Medications

#### `medications`
User medication definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Patient user ID |
| name | text | Medication name |
| dosage | text | Dosage amount |
| dosage_unit | text | Unit (mg, ml, etc.) |
| form | text | Form (tablet, capsule, etc.) |
| instructions | text | Usage instructions |
| prescriber | text | Prescribing doctor |
| pharmacy | text | Dispensing pharmacy |
| is_active | boolean | Active medication |
| prescription_status | text | pending, active, completed |
| refills_remaining | integer | Remaining refills |

#### `medication_schedules`
Dosing schedule definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| medication_id | uuid | Medication reference |
| user_id | uuid | Patient user ID |
| time_of_day | time | Scheduled time |
| days_of_week | integer[] | Days (0=Sun, 6=Sat) |
| quantity | integer | Number of doses |
| with_food | boolean | Take with food |
| is_active | boolean | Schedule active |

#### `medication_logs`
Dose tracking records.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Patient user ID |
| medication_id | uuid | Medication reference |
| schedule_id | uuid | Schedule reference |
| scheduled_time | timestamptz | When dose was due |
| status | text | pending, taken, missed, skipped |
| taken_at | timestamptz | When actually taken |
| notes | text | User notes |

### Notifications

#### `patient_notification_preferences`
Per-user notification settings.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| email_reminders | boolean | Email enabled |
| sms_reminders | boolean | SMS enabled |
| whatsapp_reminders | boolean | WhatsApp enabled |
| in_app_reminders | boolean | Push enabled |
| quiet_hours_enabled | boolean | Quiet hours active |
| quiet_hours_start | time | Start of quiet period |
| quiet_hours_end | time | End of quiet period |

#### `notification_history`
Delivery tracking for all notifications.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Recipient user ID |
| channel | text | email, sms, whatsapp, push |
| notification_type | text | medication_reminder, etc. |
| title | text | Notification title |
| body | text | Notification body |
| status | text | pending, sent, delivered, failed |
| error_message | text | Failure reason |
| delivered_at | timestamptz | Delivery timestamp |
| opened_at | timestamptz | Open tracking |
| clicked_at | timestamptz | Click tracking |
| retry_count | integer | Retry attempts |
| metadata | jsonb | Additional data |

### Security

#### `login_attempts`
Failed and successful login tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | Attempted email |
| user_id | uuid | User if exists |
| success | boolean | Login result |
| ip_address | text | Client IP |
| user_agent | text | Browser info |

#### `account_lockouts`
Account lockout records after failed attempts.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | text | Locked email |
| user_id | uuid | User if exists |
| locked_at | timestamptz | Lock timestamp |
| locked_until | timestamptz | Unlock time |
| failed_attempts | integer | Attempt count |
| unlocked_by | uuid | Admin who unlocked |

#### `trusted_devices`
Remembered devices for MFA bypass.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| device_token_hash | text | Hashed device token |
| device_name | text | User-assigned name |
| browser | text | Browser info |
| operating_system | text | OS info |
| ip_address | text | Registration IP |
| expires_at | timestamptz | Trust expiry |
| is_active | boolean | Active status |

#### `mfa_recovery_codes`
Backup codes for MFA recovery.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | User reference |
| code_hash | text | Hashed recovery code |
| used_at | timestamptz | When used |

### Clinical

#### `prescriptions`
E-prescription records.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| prescription_number | text | Unique RX number |
| patient_user_id | uuid | Patient reference |
| clinician_user_id | uuid | Prescriber reference |
| medication_name | text | Prescribed medication |
| dosage | text | Dosage instructions |
| quantity | integer | Quantity prescribed |
| refills | integer | Refills authorized |
| status | text | draft, pending, sent, filled |
| pharmacy_id | uuid | Target pharmacy |

#### `appointments`
Patient-clinician appointments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| patient_user_id | uuid | Patient reference |
| clinician_user_id | uuid | Clinician reference |
| appointment_date | date | Appointment date |
| appointment_time | time | Appointment time |
| duration_minutes | integer | Duration |
| status | text | scheduled, completed, cancelled |
| is_video_call | boolean | Telemedicine flag |
| video_room_id | uuid | Video room reference |

## Key Relationships

```
auth.users (Supabase Auth)
    │
    ├── profiles (1:1)
    │       └── patient_notification_preferences (1:1)
    │
    ├── user_roles (1:many)
    │
    ├── organization_members (1:many)
    │       └── organizations (many:1)
    │
    ├── medications (1:many) [as patient]
    │       ├── medication_schedules (1:many)
    │       └── medication_logs (1:many)
    │
    ├── prescriptions (1:many) [as patient or clinician]
    │
    ├── appointments (1:many) [as patient or clinician]
    │
    └── caregiver_invitations (1:many) [as patient or caregiver]
```

## Row Level Security (RLS)

All tables have RLS enabled. Key policy patterns:

### Own Data Access
```sql
-- Users see only their own data
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);
```

### Role-Based Access
```sql
-- Clinicians can view assigned patients
CREATE POLICY "Clinicians view assigned patients"
ON medications FOR SELECT
USING (
  public.is_clinician(auth.uid()) AND
  public.is_clinician_assigned(user_id, auth.uid())
);
```

### Organization Scoped
```sql
-- Organization members see org data
CREATE POLICY "Members view org data"
ON organization_branding FOR SELECT
USING (
  public.can_access_organization(auth.uid(), organization_id)
);
```

### Admin Override
```sql
-- Admins have full access
CREATE POLICY "Admins have full access"
ON medications FOR ALL
USING (public.is_admin(auth.uid()));
```

## Helper Functions

Database functions for common access checks:

| Function | Purpose |
|----------|---------|
| `is_admin(user_id)` | Check if user has admin role |
| `is_clinician(user_id)` | Check if user has clinician role |
| `is_pharmacist(user_id)` | Check if user has pharmacist role |
| `is_patient(user_id)` | Check if user has patient role |
| `is_clinician_assigned(patient_id, clinician_id)` | Check assignment |
| `is_caregiver_for_patient(patient_id, caregiver_id)` | Check caregiver relationship |
| `can_access_organization(user_id, org_id)` | Check org membership |
| `is_org_admin(user_id)` | Check org admin status |

## Migration Conventions

1. **Naming**: `YYYYMMDD_description.sql` (e.g., `20240115_add_medications_table.sql`)
2. **Idempotent**: Use `IF NOT EXISTS` and `IF EXISTS` 
3. **RLS Always**: Enable RLS on all new tables
4. **Foreign Keys**: Use ON DELETE CASCADE or SET NULL appropriately
5. **Timestamps**: Include `created_at` and `updated_at` with triggers
6. **Indexes**: Add indexes for frequently queried columns

## Triggers

### Updated At Trigger
```sql
CREATE TRIGGER update_medications_updated_at
BEFORE UPDATE ON medications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Audit Logging
```sql
CREATE TRIGGER audit_medications_changes
AFTER INSERT OR UPDATE OR DELETE ON medications
FOR EACH ROW
EXECUTE FUNCTION log_audit_event();
```

### Stock Management
```sql
-- Auto-update controlled drug stock on dispense
CREATE TRIGGER update_stock_on_dispense
AFTER INSERT ON controlled_drug_dispensing
FOR EACH ROW
EXECUTE FUNCTION update_controlled_drug_stock_on_dispense();
```
