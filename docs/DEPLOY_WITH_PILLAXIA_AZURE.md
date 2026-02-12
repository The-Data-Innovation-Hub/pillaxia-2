# Deploy using pillaxia-azure repo

Deployments run from **pillaxia-azure** via GitHub Actions. Code is synced from pillaxia-2 when you’re ready to release.

## 1. One-time: secrets in pillaxia-azure

In **pillaxia-azure**: **Settings → Secrets and variables → Actions**. Add the same secrets you use for Azure (see `docs/PILLAXIA_AZURE_REPO.md` for the full list). At minimum for the main deploy:

- `AZURE_API_PUBLISH_PROFILE`
- `AZURE_API_APP_NAME`
- `AZURE_CREDENTIALS`
- `AZURE_RESOURCE_GROUP`
- `AZURE_FUNCTIONS_PUBLISH_PROFILE`
- `AZURE_PG_HOST`, `AZURE_PG_USER`, `AZURE_PG_PASSWORD`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `VITE_API_URL`, `VITE_AZURE_FUNCTIONS_URL`, `VITE_ENTRA_*` (and any other `VITE_*` your app needs)

## 2. Sync code from pillaxia-2 to pillaxia-azure

When you want to deploy, push **main** from pillaxia-2 to pillaxia-azure:

```bash
cd /path/to/pillaxia-2
git checkout main
git pull origin main
git push azure main:main --force
```

(Use `--force` because the two repos don’t share history.)

## 3. How the deploy runs

- **On push to `main`** in pillaxia-azure, the **Azure Deploy** workflow runs:
  - Runs DB migrations (on main only)
  - Runs tests (frontend, api, functions)
  - Builds and deploys: API (App Service), Functions, Static Web App
- **Manual run**: In pillaxia-azure go to **Actions → Azure Deploy → Run workflow**. You can choose to run migrations and pick the branch (default `main`).

## 4. Other workflows in pillaxia-azure

- **Deploy Staging** – manual; deploys to staging slot.
- **Rollback** – manual; redeploys previous API version.
- **Azure Deploy Functions** – manual; deploys only Azure Functions.
- **E2E tests** – can run on push or manually (needs E2E secrets).
- **Security scan**, **Bump version** – as configured.

## Summary

1. Add secrets in pillaxia-azure (once).
2. When ready to release: `git push azure main:main --force` from pillaxia-2.
3. Deployment runs automatically on that push, or trigger **Azure Deploy** manually from the Actions tab.
