# Deployment Runbook

## Overview

Pillaxia uses GitHub Actions for CI/CD, deploying to Azure App Service (API), Azure Static Web Apps (frontend), and Azure Functions (scheduled jobs).

## Prerequisites

- Azure CLI installed and authenticated (`az login`)
- GitHub repository access with push permissions
- Required GitHub Secrets configured (see `.env.example` for reference)

## Standard Deployment (Push to main)

1. **Merge PR to main** -- triggers the `Azure Deploy` workflow automatically
2. **Migrations run first** -- `scripts/run_migrations_azure.sh` executes pending SQL migrations
3. **Frontend builds** -- Vite build with production env vars
4. **API deploys** -- Zip deployed to Azure App Service
   - If `USE_STAGING_SLOT=true`, deploys to staging slot first
   - Health check runs on staging slot
   - Slot swap promotes staging to production
5. **Functions deploy** -- Azure Functions deployed via `functions-action`
6. **Health check** -- Automated post-deploy health check against `/health/ready`

## Manual Deployment

```bash
# Trigger deployment via GitHub Actions
gh workflow run "Azure Deploy" --ref main

# Trigger with migrations
gh workflow run "Azure Deploy" --ref main -f run_migrations=true
```

## Staging Deployment

Deploy any branch to the staging slot for testing:

```bash
gh workflow run "Deploy to Staging" --ref feature/my-branch
```

## Rollback Procedure

### Immediate Rollback (Slot Swap)

If using deployment slots, roll back instantly:

```bash
# Via GitHub Actions
gh workflow run "Rollback Production" -f confirm=rollback

# Via Azure CLI (manual)
az webapp deployment slot swap \
  -g $RESOURCE_GROUP \
  -n $APP_NAME \
  --slot staging \
  --target-slot production
```

### Full Rollback (Revert Commit)

If slot swap is unavailable:

```bash
git revert HEAD
git push origin main
# This triggers a new deployment with the reverted code
```

## Monitoring During Deployment

```bash
# Watch deployment logs
az webapp log tail -g $RESOURCE_GROUP -n $APP_NAME

# Check health endpoint
curl -s https://pillaxia-dev-api.azurewebsites.net/health/ready | jq

# Check Functions health
az functionapp show -g $RESOURCE_GROUP -n pillaxia-dev-functions --query state
```

## Troubleshooting

| Symptom | Likely Cause | Action |
|---------|-------------|--------|
| Health check fails | DB connection issue | Check `PGHOST`, `DATABASE_URL` secrets |
| 503 on all endpoints | App not started | Check App Service logs, restart |
| Migrations fail | SQL syntax error | Fix migration, push new commit |
| Functions not triggering | Deployment issue | Check Functions deployment logs |
| Slot swap fails | No staging slot | Create staging slot in Azure Portal |

## Deployment Approval Gates

Production deployments require reviewer approval via GitHub Environments:

### Setup (one-time, requires admin access)

1. Go to **Settings > Environments** in the GitHub repository
2. Create or edit the **production** environment
3. Check **Required reviewers** and add at least one reviewer
4. Optionally set **Wait timer** (e.g. 5 minutes) for an observation window
5. Optionally restrict to the `main` branch under **Deployment branches**

Once configured, any workflow job with `environment: production` will pause and require manual approval before executing.

### Approving a deployment

1. Navigate to the **Actions** tab in GitHub
2. Open the running workflow
3. Click **Review deployments** on the paused job
4. Select the **production** environment and click **Approve and deploy**

### Bypassing (emergency only)

Repository admins can bypass the review requirement. Document any bypass in the incident response log.

## Environment Variables

All required environment variables are documented in `.env.example`. Ensure they are set in:
- GitHub Secrets (for CI/CD)
- Azure App Service Configuration (for runtime)
- Azure Functions Configuration (for Functions runtime)
