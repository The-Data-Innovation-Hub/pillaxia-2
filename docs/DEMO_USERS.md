# Demo users (demo.pillaxia.com)

These accounts are for demonstrating the platform. The app shows a **“Demo data – for demonstration only”** banner when you sign in with any of them.

| Username (email)              | Role       | Password        |
|------------------------------|------------|-----------------|
| `patient@demo.pillaxia.com`  | Patient    | `PillaxiaDemo1!` |
| `clinician@demo.pillaxia.com`| Clinician  | `PillaxiaDemo1!` |
| `pharmacist@demo.pillaxia.com`| Pharmacist | `PillaxiaDemo1!` |
| `manager@demo.pillaxia.com`  | Manager    | `PillaxiaDemo1!` |

**Same password for all:** `PillaxiaDemo1!` (meets typical complexity: upper, lower, number, symbol).

---

## “We couldn’t find an account with this email address”

If you see that message when signing in with e.g. `patient@demo.pillaxia.com`, the **identity provider** (Microsoft Entra) does not have that user yet. The seed script only creates users in the **database** (profiles, roles, demo data); it does **not** create accounts in Entra. You must create the demo users in Azure AD B2C / Entra first (see **Option A** below). After they exist in Entra and sign in once, the app/API can sync them to `public.users`; the seed then ensures profiles and roles exist for the seeded UUIDs or you run the by-email script if Entra issued different IDs.

---

## How to create them

Authentication is handled by **Microsoft Entra** (Azure AD B2C / External ID). Passwords are not stored in the app database; they live in Entra.

### Option A: Azure Portal (recommended)

1. In **Azure Portal** go to your Entra tenant (External ID or B2C).
2. Create a user for each row above:
   - **User principal name / Sign-in name:** the email (e.g. `patient@demo.pillaxia.com`).
   - **Display name:** e.g. “Demo Patient”.
   - **Password:** set to `PillaxiaDemo1!` (or your chosen password).
3. After each user signs in at least once, the API will sync them into `public.users`.
4. Run the seed so profiles and roles exist. **In the same terminal**, set your DB URL then run the seed script:
   ```bash
   export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
   ./scripts/run-seed.sh
   ```
   (If you run `psql` without a set `DATABASE_URL`, it will use the default local connection and ask for your macOS user password.)
   The seed already includes these four users (with fixed UUIDs). If your Entra tenant issues **different** user IDs on first sign-in, those IDs will be created by the API sync; then run the **by-email** script so profile and role are attached to the Entra-backed user:
   ```bash
   psql "$DATABASE_URL" -f scripts/seed-demo-pillaxia-users-by-email.sql
   ```
   (That script ensures profile and role exist for each `*@demo.pillaxia.com` email in `public.users`.)

### Create account flow (new users signing up in the app)

When someone uses the **Create account** flow (Microsoft’s hosted sign-up page) and completes registration in Entra:

1. **Entra** creates the user (they can sign in from then on).
2. On first sign-in, the **API** syncs them to `public.users` via `upsert_user_from_jwt`.
3. A **database trigger** (`handle_new_user`) runs on insert into `public.users` and creates a **profile** (first/last name from Entra claims, default language/timezone) and a **default role** (`patient`), so they can use the app immediately without an extra “choose role” step.  
   If your DB has the fix migration `20260206100000_fix_handle_new_user_after_profiles_3nf.sql` applied, this works with the current 3NF profiles table (no email column). If the trigger is missing or broken, new users are still synced to `public.users` but will see the **Select role** page once so they can set profile and role.

**Giving the demo user dummy data (medications, schedule, vitals, etc.)**  
The trigger only creates profile and role; it does not create medications, schedules, or other demo data. So after the demo patient (or any demo user) has signed in at least once:

1. Ensure the **main seed** has been run so template data exists: `./scripts/run-seed.sh`
2. Copy that template data to the demo user by email:
   ```bash
   psql "$DATABASE_URL" -v user_email='patient@demo.pillaxia.com' -f scripts/seed-demo-for-user.sql
   ```
   Use the same email they sign in with (e.g. `patient@demo.pillaxia.com`, `clinician@demo.pillaxia.com`). Then have them refresh the app; they should see medications, schedule, vitals, and other demo data.

**If the DB doesn’t have the “manager” role**  
Some databases were created before the `manager` value was added to the `app_role` enum. Run once:
```bash
psql "$DATABASE_URL" -f scripts/add_manager_app_role.sql
```

**Fixing roles when everyone gets “patient”**  
The new-user trigger assigns the default role `patient`. For demo clinician, pharmacist, manager, and for your main account (e.g. `pillaxia@thedatainnovationhub.com`), run the role script after they have signed in at least once:
```bash
psql "$DATABASE_URL" -f scripts/set_roles_by_email.sql
```
Edit `scripts/set_roles_by_email.sql` to set the (email, role) pairs you need (clinician, pharmacist, manager, admin). Users may need to sign out and sign in again for the new role to apply.

### Option B: Seed-only (no Entra yet)

If you are not using Entra yet (e.g. local/test with a stub auth that accepts the seeded IDs):

1. Run the main seed; it creates the four demo users in `public.users` with fixed UUIDs, plus profiles and roles:
   ```bash
   psql "$DATABASE_URL" -f scripts/seed-azure-dev-data.sql
   ```
2. Configure your auth layer so that when someone “logs in” as e.g. `patient@demo.pillaxia.com`, the JWT or session uses the same user ID as in the seed (see script for UUIDs).

---

## Running the seed: connection troubleshooting

If you see **"connection to server on socket …"** or **"password authentication failed for user …"**, `psql` is not using your database URL—usually because **`DATABASE_URL` is not set** in the shell.

1. **Set your PostgreSQL connection string** (the same DB your app/API uses):
   ```bash
   export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require'
   ```
   - **Azure PostgreSQL**: In Azure Portal → your Flexible Server → **Settings** → **Connection strings**, copy the **ADO.NET** or **Connection string** and adapt it to the form above (user, password, host, port, database). Use `sslmode=require` for Azure. If the admin user is an email (e.g. `pillaxia@thedatainnovationhub.com`), encode the `@` in the username as `%40` in the URL: `pillaxia%40thedatainnovationhub.com`.
   - **Local PostgreSQL**: e.g. `export DATABASE_URL='postgresql://postgres:yourpassword@localhost:5432/pillaxia'`

2. **Run the seed again** (in the same terminal where you set `DATABASE_URL`):
   ```bash
   ./scripts/run-seed.sh
   ```

3. **If the password contains `@`, `#`, or `%`**, URL-encode them or the host will be parsed wrongly (e.g. "socket @@ hostname"): `@` → `%40`, `#` → `%23`, `%` → `%25`. Example: password `my@pass` → use `my%40pass` in the URL. Alternatively:
   - URL-encode them in the connection string (e.g. `%40` for `@`), or
   - Use a password file so you don’t put the password in the URL:
     ```bash
     echo "hostname:port:database:user:password" > ~/.pgpass
     chmod 600 ~/.pgpass
     psql -h HOST -p PORT -U USER -d DATABASE -f scripts/seed-azure-dev-data.sql
     ```

4. **Check the admin username** in Azure: Portal → your PostgreSQL Flexible Server → **Overview** (or **Connection strings**). The admin login is set when the server is created. If it’s an email, use `%40` for `@` in the URL (e.g. `pillaxia%40thedatainnovationhub.com`).

5. **Verify** `DATABASE_URL` is set before running:
   ```bash
   echo "$DATABASE_URL"
   ```
   If this is empty, set it as in step 1 and run the seed again.

6. **Confirm the user works**: If the seed runs without "password authentication failed", the admin user and password are correct.

---

## Summary

- **Username** = email (e.g. `patient@demo.pillaxia.com`).
- **Role** = patient | clinician | pharmacist | manager (see table above).
- **Password** = set in Microsoft Entra; suggested value for all four: `PillaxiaDemo1!`.
