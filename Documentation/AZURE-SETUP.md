# Azure Deployment — Manual Setup Guide

This app deploys to **Azure App Service (Free F1 tier)** via GitHub Actions. The CI/CD workflow (`.github/workflows/azure-deploy.yml`) handles build and deploy automatically on every push to `main`, but the Azure resources and GitHub secrets must be created manually first.

## One-time setup steps

### 1. Create the Azure App Service

1. Go to the [Azure Portal](https://portal.azure.com) → **Create a resource** → **Web App**.
2. Configure:
   - **Name**: choose a unique name (e.g. `familypassportmap`) — this becomes `<name>.azurewebsites.net`
   - **Runtime stack**: Node 24 LTS
   - **Region**: pick the closest to you
   - **Pricing plan**: Free (F1)
3. Create the resource.

### 2. Configure app settings

In the App Service → **Settings** → **Environment variables**, add:

| Name | Value | Purpose |
|------|-------|---------|
| `DATA_DIR` | `/home/data` | Persistent storage for SQLite DB + uploaded photos |
| `NODE_ENV` | `production` | Tells Express to serve the built frontend |

The `/home` directory persists across restarts and redeploys on Azure App Service. Never use `/tmp` — it's wiped on restart.

### 3. Set the startup command

In the App Service → **Settings** → **Configuration** → **General settings**:

- **Startup Command**: `bash startup.sh`

`startup.sh` (repo root) sets `NODE_ENV=production`, restores the `@familypassportmap/shared` workspace symlink, runs `prisma migrate deploy` so new schema migrations apply on every deploy, then starts `node apps/server/dist/index.js`, which serves both the API and the built web app. (Plain `npm start` skips the migrations and the symlink.)

This is set once here, in the App Service; the deploy workflow doesn't repeat it.

### 4. Connect GitHub Actions (OIDC — no stored passwords)

The deploy workflow signs in to Azure with **OpenID Connect**: GitHub issues a short-lived token per run, and Azure trusts it through a federated credential. No publish profile or client secret is stored, and **SCM Basic Auth Publishing Credentials stays Off**.

Run these once from the repo root, after `az login` and `gh auth login`. The steps are:

1. Create an app registration and service principal to deploy as. *(Already done 2026-09-16: "FamilyPassportMap GitHub Deploy", client ID `6c763682-3ff8-4e5b-bbc8-2558361770fa`. Skip this step and set `CLIENT_ID` to that ID if it exists.)*
2. Trust GitHub Actions runs from this repo's `main` branch only (federated credential).
3. Let it deploy to this one web app (Website Contributor, scoped to the app only).
4. Give the workflow the non-secret IDs as repository variables.

The block has no comment lines on purpose: interactive zsh treats `#` literally, and apostrophes in comments break its quoting.

```bash
APP=family-passport-map
RG=family_passport_app_rg
REPO=BobbyJoeCool/FamilyPassportMap

CLIENT_ID=$(az ad app create --display-name "FamilyPassportMap GitHub Deploy" --query appId -o tsv)
az ad sp create --id "$CLIENT_ID"

az ad app federated-credential create --id "$CLIENT_ID" --parameters '{"name": "github-main-branch", "issuer": "https://token.actions.githubusercontent.com", "subject": "repo:'"$REPO"':ref:refs/heads/main", "audiences": ["api://AzureADTokenExchange"]}'

az role assignment create --assignee "$CLIENT_ID" --role "Website Contributor" --scope "$(az webapp show -n $APP -g $RG --query id -o tsv)"

gh variable set AZURE_CLIENT_ID --body "$CLIENT_ID"
gh variable set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
gh variable set AZURE_SUBSCRIPTION_ID --body "$(az account show --query id -o tsv)"
```

*(Optional)* Set a repository variable `AZURE_WEBAPP_NAME` if the App Service has a different name than `family-passport-map`.

Then push to `main`, or re-run the latest **Deploy to Azure** run from the repo's **Actions** tab. A role assignment can take a few minutes to take effect; if the first run fails with an authorization error, wait and re-run.

### 5. Verify

After the first deploy:
- Visit `https://<app-name>.azurewebsites.net` — People, and the US and World sections (each with Map / Compare / List), should work.
- Add a person and mark some states, then restart the App Service from the Azure portal — data should persist.
- On Chrome/Edge, the "Install app" prompt should appear (PWA).

## Architecture notes

- **Single App Service** runs one Node.js process that serves both the Express API (`/api/*`, `/uploads/*`) and the Vite-built frontend (all other routes fall through to `index.html` for client-side routing).
- **SQLite** is safe because F1 tier is always a single instance — no concurrent writer risk.
- **No custom domain or SSL** on F1 tier — the default `*.azurewebsites.net` domain with Azure-managed HTTPS is used.
