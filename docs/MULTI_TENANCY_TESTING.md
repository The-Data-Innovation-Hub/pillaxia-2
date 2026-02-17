# Multi-Tenancy Testing Guide

This guide explains how to test the multi-tenant features of Pillaxia with the demo organizations.

## 🏢 Demo Organizations

### 1. Lagos General Hospital 🏥
- **Type**: Healthcare Provider (Premium)
- **Status**: Active
- **Members**: 4 users
- **Branding**: Blue theme - "Lagos General Portal"
- **Features**: Premium license (100 max users)

**Users:**
- **Owner**: manager@demo.pillaxia.com / DemoManager2026!
  - User ID: `a1000000-0000-0000-0000-000000000001`
  - Full admin access to this organization

- **Admin**: clinician@demo.pillaxia.com / DemoClinician2026!
  - User ID: `c1000000-0000-0000-0000-000000000002`
  - Can manage members and settings

- **Members**:
  - patient.bola@pillaxia-dev.com
  - patient@demo.pillaxia.com / DemoPatient2026!

### 2. Abuja Medical Center 🏥
- **Type**: Healthcare Provider (Standard)
- **Status**: Active
- **Members**: 2 users
- **Branding**: Green theme - "Abuja Medical Hub"
- **Features**: Standard license (50 max users)

**Users:**
- **Owner**: dr.okafor@pillaxia-dev.com
  - User ID: `c0000000-0000-0000-0000-000000000002`
  - Full admin access

- **Member**: patient.dayo@pillaxia-dev.com

### 3. HealthPlus Pharmacy Network 💊
- **Type**: Pharmacy Chain (Enterprise)
- **Status**: Active
- **Members**: 2 users
- **Branding**: Purple theme - "HealthPlus Connect"
- **Features**: Enterprise license (200 max users)

**Users:**
- **Owner**: pharmacist@demo.pillaxia.com / DemoPharmacist2026!
  - User ID: `f1000000-0000-0000-0000-000000000003`
  - Full admin access

- **Admin**: pharm.adeyemi@pillaxia-dev.com
  - User ID: `f0000000-0000-0000-0000-000000000003`
  - Can manage members

### 4. Community Health Clinic 🏪
- **Type**: Small Clinic (Trial)
- **Status**: Trial
- **Members**: 1 user
- **Branding**: Orange theme - "Community Care Portal"
- **Features**: Trial license (10 max users)

**Users:**
- **Owner**: clinician@demo.pillaxia.com / DemoClinician2026!
  - User ID: `c1000000-0000-0000-0000-000000000002`
  - Full admin access

## 🧪 Testing Methods

### Method 1: Auth Bypass (Current Setup)

Update the hardcoded user ID in `api/src/index.js` (line 295):

```javascript
// Test as Lagos General Hospital owner (Manager)
req.userId = 'a1000000-0000-0000-0000-000000000001';

// Test as Abuja Medical Center owner (Clinician)
req.userId = 'c0000000-0000-0000-0000-000000000002';

// Test as HealthPlus Pharmacy owner (Pharmacist)
req.userId = 'f1000000-0000-0000-0000-000000000003';

// Test as Platform Admin (sees all organizations)
req.userId = 'a0000000-0000-0000-0000-000000000001';
```

After changing, restart the API and refresh the frontend.

### Method 2: Real Authentication

1. Remove or set `DISABLE_AUTH=false` in Azure App Service
2. Sign in with actual credentials:
   - manager@demo.pillaxia.com / DemoManager2026!
   - clinician@demo.pillaxia.com / DemoClinician2026!
   - pharmacist@demo.pillaxia.com / DemoPharmacist2026!
   - patient@demo.pillaxia.com / DemoPatient2026!

## ✅ What to Test

### Organization Isolation
- [ ] Users only see data from their organization
- [ ] Organization members can't access other organizations' data
- [ ] Platform admin can see/manage all organizations

### Custom Branding
- [ ] Each organization shows custom app name
- [ ] Different color themes per organization
- [ ] Custom support contact information

### Organization Roles
- [ ] **Owner**: Can manage all aspects, add/remove members, change settings
- [ ] **Admin**: Can manage members and some settings
- [ ] **Member**: Regular user with access to organization features

### Organization Management (Admin/Manager Dashboard)
- [ ] View organization details
- [ ] Update organization settings
- [ ] Manage members (add, remove, change roles)
- [ ] Customize branding
- [ ] View billing and license information

### Platform Admin Features
- [ ] View all organizations in system
- [ ] Create new organizations
- [ ] Suspend/activate organizations
- [ ] Change license types
- [ ] Manage cross-organization users

## 📊 Organization Comparison

| Feature | Trial | Standard | Premium | Enterprise |
|---------|-------|----------|---------|------------|
| Max Users | 10 | 50 | 100 | 200 |
| Custom Branding | ✓ | ✓ | ✓ | ✓ |
| Priority Support | ✗ | ✗ | ✓ | ✓ |
| API Access | ✗ | ✗ | ✓ | ✓ |
| Example Org | Community Clinic | Abuja Medical | Lagos General | HealthPlus |

## 🔧 Troubleshooting

### Not seeing organization data?
- Verify user is assigned to an organization in `organization_members`
- Check `profiles.organization_id` is set
- Ensure RLS policies allow access

### Branding not showing?
- Check `organization_branding` table has entry for the organization
- Clear browser cache and refresh
- Verify OrganizationContext is loading data

### Can't switch organizations?
- Users can only belong to one primary organization
- Platform admin can view all organizations
- To test different orgs, use Method 1 (auth bypass) or different user accounts

## 📝 Notes

- Organizations are completely isolated from each other
- Data is segregated at the database level using RLS (Row Level Security)
- Platform admin role bypasses organization restrictions
- Each organization can customize their own branding and settings
