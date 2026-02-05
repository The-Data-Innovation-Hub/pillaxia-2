# Pillaxia Azure Infrastructure

Bicep templates for deploying Pillaxia to Azure. Default region is **North Europe (Ireland/Dublin)** (`northeurope`).

## Resources Deployed

- **Azure Database for PostgreSQL Flexible Server** - Database (v15)
- **Azure Key Vault** - Secrets (DB, Stripe, Resend, Twilio)
- **Azure Storage Account** - Blob storage (lab results, prescriptions, avatars)
- **App Service Plan** - Premium V2 (Linux)
- **App Service** - API/PostgREST hosting
- **Azure Functions** - Edge function migration (cron, webhooks)

## Azure AD B2C Setup (Manual)

Azure AD B2C is configured separately. Steps:

1. Create Azure AD B2C tenant in Azure Portal
2. Configure user flows: Sign-up, Sign-in, Password reset, Profile edit
3. Configure MFA (TOTP) via custom policies
4. Create app registration for SPA and API
5. Configure JWT token claims: `oid`, `emails`, `name`
6. Add B2C tenant name, client ID, authority to Key Vault

## Prerequisites

- Azure CLI or PowerShell
- Azure subscription
- Contributor role on subscription or resource group

## Deployment

### Option 1: Azure CLI

```bash
cd infrastructure/azure

# Create resource group and deploy (interactive - prompts for password)
az deployment sub create \
  --location northeurope \
  --template-file main.bicep \
  --parameters resourceGroupName=pillaxia-rg \
               environment=dev \
               postgresAdminLogin=pillaxiaadmin \
               postgresAdminPassword='YOUR_SECURE_PASSWORD'
```

### Option 2: Parameters File

```bash
# Edit parameters.dev.json with your values
az deployment sub create \
  --location northeurope \
  --template-file main.bicep \
  --parameters parameters.dev.json
```

### Option 3: What-If (Preview)

```bash
az deployment sub what-if \
  --location northeurope \
  --template-file main.bicep \
  --parameters parameters.dev.json
```

## Post-Deployment

1. Enable PostgreSQL extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`
2. Create application database user
3. Run migrations (see `scripts/run_migrations_azure.sh`)
4. Add secrets to Key Vault (Stripe, Resend, Twilio)
5. Configure App Service and Functions with Key Vault references

## Naming Conventions

- Resource group: `pillaxia-{env}-rg`
- PostgreSQL: `pillaxia-{env}-pg`
- Key Vault: `pillaxia{env}kv` (no hyphens - KV requirement)
- Storage: `pillaxia{env}st` (no hyphens - globally unique)
- App Service: `pillaxia-{env}-api`
- Functions: `pillaxia-{env}-func`
