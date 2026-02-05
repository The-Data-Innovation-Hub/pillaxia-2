# Azure Migration Guide

Migration from Supabase/Lovable Cloud to Azure.

## Customer identity: Entra External ID (not B2C)

**As of May 2025, new Azure AD B2C tenants cannot be created.** Use **Microsoft Entra External ID** (external tenants) instead.

### Create an external tenant (Entra External ID)

1. **Entra admin center**  
   Go to [entra.microsoft.com](https://entra.microsoft.com) (or Azure Portal → search **Microsoft Entra ID** → ensure you’re in the right directory).

2. **Create external tenant**  
   - **Identity** → **External ID** → **Overview** (or **All identity** → **External ID**).  
   - Use **“Create external tenant”** / **“New external tenant”** (wording may vary).  
   - Or in **Azure Portal**: Create a resource → search **“External ID”** or **“Create external tenant”** and follow the wizard.

3. **Quickstart from Azure**  
   Docs: [Quickstart: Use your Azure subscription to create an external tenant](https://learn.microsoft.com/en-us/entra/external-id/customers/quickstart-tenant-setup).  
   You need an Azure subscription and an account with **Tenant Creator** (or equivalent). Creation can take up to ~30 minutes.

4. **After creation**  
   - Note the **tenant subdomain** (e.g. `pillaxia`) and **tenant ID** (GUID).  
   - Sign-in uses **ciamlogin.com**:  
     `https://<tenant-subdomain>.ciamlogin.com/<tenant-id>/`  
     or  
     `https://<tenant-subdomain>.ciamlogin.com/<tenant-subdomain>.onmicrosoft.com/`

5. **In the external tenant**  
   - **App registrations** → New registration (SPA, redirect URIs).  
   - **User flows** (or equivalent) → Sign-up and sign-in.  
   - Use the **Application (client) ID** and **Directory (tenant) ID** in your app.

### Frontend env for Entra External ID

Use **one** of these:

**Option A – Entra External ID (recommended for new setups)**

```env
VITE_USE_AZURE_AUTH=true
VITE_API_URL=https://your-api.azurewebsites.net
VITE_ENTRA_CLIENT_ID=<app-client-id-from-external-tenant>
# Authority: use ONE of these (replace with your actual tenant ID and/or subdomain)
# Option 1 – tenant ID in both subdomain and path (most reliable):
VITE_ENTRA_EXTERNAL_ID_AUTHORITY=https://<tenant-id>.ciamlogin.com/<tenant-id>/v2.0/
# Option 2 – subdomain only (if your tenant uses it):
# VITE_ENTRA_EXTERNAL_ID_AUTHORITY=https://<subdomain>.ciamlogin.com/
# Option 3 – subdomain + tenant ID path:
# VITE_ENTRA_EXTERNAL_ID_AUTHORITY=https://<subdomain>.ciamlogin.com/<tenant-id>/v2.0/
VITE_ENTRA_SCOPES=openid,profile,email
```

**Option B – Existing Azure AD B2C tenant**

```env
VITE_USE_AZURE_AUTH=true
VITE_API_URL=https://your-api.azurewebsites.net
VITE_AZURE_B2C_CLIENT_ID=...
VITE_AZURE_B2C_TENANT=...
VITE_AZURE_B2C_POLICY=B2C_1_signin
VITE_AZURE_B2C_AUTHORITY=https://<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/B2C_1_signin
VITE_AZURE_B2C_SCOPES=openid,profile,email
```

The app reads `VITE_ENTRA_EXTERNAL_ID_AUTHORITY` first; if set, it uses Entra External ID (ciamlogin.com). Otherwise it uses the B2C env vars.

## GitHub Secrets for Azure Deploy

Configure these in GitHub repository Settings > Secrets and variables > Actions:

| Secret | Description |
|--------|-------------|
| AZURE_STATIC_WEB_APPS_API_TOKEN | Static Web Apps deployment token |
| AZURE_API_APP_NAME | App Service name for API |
| AZURE_API_PUBLISH_PROFILE | API publish profile (download from Azure Portal) |
| AZURE_FUNCTION_APP_NAME | Azure Functions app name |
| AZURE_FUNCTIONS_PUBLISH_PROFILE | Functions publish profile |
| AZURE_PG_HOST | PostgreSQL server hostname |
| AZURE_PG_USER | PostgreSQL admin user |
| AZURE_PG_PASSWORD | PostgreSQL admin password |
| VITE_USE_AZURE_AUTH | Set to 'true' for Azure AD B2C |
| VITE_API_URL | API base URL |
| VITE_AZURE_B2C_CLIENT_ID | B2C app registration client ID |
| VITE_AZURE_B2C_TENANT | B2C tenant name |
| VITE_AZURE_B2C_POLICY | B2C user flow (optional if using Entra External ID) |
| VITE_ENTRA_CLIENT_ID | Entra External ID app client ID (if not B2C) |
| VITE_ENTRA_EXTERNAL_ID_AUTHORITY | Entra External ID authority, e.g. https://&lt;subdomain&gt;.ciamlogin.com/&lt;tenant-id&gt;/ |

## Environment Variables for Azure Mode

See **Customer identity: Entra External ID** above for full env examples. For B2C-only:

```
VITE_USE_AZURE_AUTH=true
VITE_API_URL=https://your-api.azurewebsites.net
VITE_AZURE_B2C_CLIENT_ID=your-client-id
VITE_AZURE_B2C_TENANT=your-tenant
VITE_AZURE_B2C_POLICY=B2C_1_signin
VITE_AZURE_B2C_AUTHORITY=https://your-tenant.b2clogin.com/your-tenant.onmicrosoft.com/B2C_1_signin
VITE_AZURE_B2C_SCOPES=openid,profile,email
```

### Troubleshooting: "Endpoints cannot be resolved"

MSAL fetches OAuth endpoints from `{authority}.well-known/openid-configuration`. If that fails, the app shows the discovery URL in the error message—open it in your browser. If you don’t see JSON, the authority format is wrong.

**Set the authority in `.env` to one of these (use your Directory (tenant) ID from the Entra app registration):**

1. **Tenant ID as subdomain and path (try this first)**  
   `https://<tenant-id>.ciamlogin.com/<tenant-id>/v2.0/`  
   Example: `https://a1b2c3d4-e5f6-7890-abcd-ef1234567890.ciamlogin.com/a1b2c3d4-e5f6-7890-abcd-ef1234567890/v2.0/`

2. **Subdomain only**  
   `https://<subdomain>.ciamlogin.com/`  
   Example: `https://pillaxia.ciamlogin.com/`  
   (Use the tenant subdomain, e.g. from `contoso.onmicrosoft.com` → `contoso`.)

3. **Subdomain + tenant ID path**  
   `https://<subdomain>.ciamlogin.com/<tenant-id>/v2.0/`

After changing `.env`, restart the dev server. Also ensure the app registration has your redirect URI (e.g. `http://localhost:8080`) under Authentication.

**Discovery works in browser but app still fails (CORS):** If opening the discovery URL in a new tab shows JSON but the app still reports "Endpoints cannot be resolved", the browser is blocking the app’s fetch (CORS). Workaround: pass the discovery document yourself so MSAL doesn’t fetch it.

1. Open the discovery URL in your browser (the one from the error message, or `{authority}.well-known/openid-configuration`).
2. Copy the **entire** JSON (one line is fine).
3. In `.env`, add (use single quotes so the JSON is one value):
   ```env
   VITE_ENTRA_AUTHORITY_METADATA='{"token_endpoint":"https://...","authorization_endpoint":"https://...", ...}'
   ```
   Paste your copied JSON inside the single quotes. Restart the dev server.

## Data Layer Migration

When `VITE_USE_AZURE_AUTH=true`, the app uses:
- **Auth**: Azure AD B2C via MSAL.js (AzureAuthContext)
- **Data**: API client pointing to PostgREST proxy

Hooks that use `supabase` directly need to be updated to use the API client when in Azure mode. Options:
1. Create a unified client that switches based on env
2. Update each hook to use the API client when VITE_USE_AZURE_AUTH
3. Use Supabase client with custom URL pointing to API + custom auth

See `src/integrations/api/client.ts` for the API client interface.
