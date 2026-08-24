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

- **Startup Command**: `npm start`

This runs `NODE_ENV=production node apps/server/dist/index.js` from the root, which serves both the API and the built web app.

### 4. Connect GitHub Actions

1. In the App Service → **Deployment Center** → download the **Publish Profile** (or go to **Settings** → **Configuration** → **Publish profile** → **Download**).
2. In your GitHub repo → **Settings** → **Secrets and variables** → **Actions**:
   - Add a **repository secret** named `AZURE_WEBAPP_PUBLISH_PROFILE` with the downloaded publish profile XML as its value.
   - Add a **repository variable** named `AZURE_WEBAPP_NAME` with the App Service name (e.g. `familypassportmap`).
3. Push to `main` — the deploy workflow will trigger automatically.

### 5. Verify

After the first deploy:
- Visit `https://<app-name>.azurewebsites.net` — all four pages (People, Map, Compare, List) should work.
- Add a person and mark some states, then restart the App Service from the Azure portal — data should persist.
- On Chrome/Edge, the "Install app" prompt should appear (PWA).

## Architecture notes

- **Single App Service** runs one Node.js process that serves both the Express API (`/api/*`, `/uploads/*`) and the Vite-built frontend (all other routes fall through to `index.html` for client-side routing).
- **SQLite** is safe because F1 tier is always a single instance — no concurrent writer risk.
- **No custom domain or SSL** on F1 tier — the default `*.azurewebsites.net` domain with Azure-managed HTTPS is used.
