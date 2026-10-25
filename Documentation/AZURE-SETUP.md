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
| `MICROSOFT_CLIENT_ID` | the app registration's Application (client) ID | Microsoft sign-in (see step 6). **Required**: the server refuses to start without it |
| `MICROSOFT_CLIENT_SECRET` | the client secret's **Value** | Microsoft sign-in. **Required**. Expires; see step 6 |
| `APP_BASE_URL` | `https://<app-name>.azurewebsites.net` | The address people open the app at, used to build Microsoft's redirect URI. **Required** |
| `LEGACY_DATA_OWNER_EMAIL` | your **personal** Microsoft account's email | The site owner. On their sign-in they Adopt the People recorded before login (People with no Owner). Matched case-insensitively, and only for a personal Microsoft account (never a work or school one). If unset, nobody Adopts them and they stay invisible. |

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

The federated credential's `subject` must match **exactly** what GitHub puts in the token. This repo's tokens use GitHub's immutable-ID format, `repo:<owner>@<owner-id>/<repo>@<repo-id>:ref:refs/heads/main`, not the older `repo:<owner>/<repo>:ref:…`. A mismatch fails the login with `AADSTS700213: No matching federated identity record found`, and the error message shows the subject GitHub actually sent.

The block has no comment lines on purpose: interactive zsh treats `#` literally, and apostrophes in comments break its quoting.

```bash
APP=family-passport-map
RG=family_passport_app_rg

CLIENT_ID=$(az ad app create --display-name "FamilyPassportMap GitHub Deploy" --query appId -o tsv)
az ad sp create --id "$CLIENT_ID"

az ad app federated-credential create --id "$CLIENT_ID" --parameters '{"name": "github-main-branch", "issuer": "https://token.actions.githubusercontent.com", "subject": "repo:BobbyJoeCool@225921535/FamilyPassportMap@1331524503:ref:refs/heads/main", "audiences": ["api://AzureADTokenExchange"]}'

az role assignment create --assignee "$CLIENT_ID" --role "Website Contributor" --scope "$(az webapp show -n $APP -g $RG --query id -o tsv)"

gh variable set AZURE_CLIENT_ID --body "$CLIENT_ID"
gh variable set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
gh variable set AZURE_SUBSCRIPTION_ID --body "$(az account show --query id -o tsv)"
```

*(Optional)* Set a repository variable `AZURE_WEBAPP_NAME` if the App Service has a different name than `family-passport-map`.

Then push to `main`, or re-run the latest **Deploy to Azure** run from the repo's **Actions** tab. A role assignment can take a few minutes to take effect; if the first run fails with an authorization error, wait and re-run.

### 5. Verify

After the first deploy:
- Visit `https://<app-name>.azurewebsites.net`. You should land on the sign-in page. After signing in with Microsoft and finishing the welcome step, People and the US and World sections (each with Map / Compare / List) should work.
- Add a person and mark some states, then restart the App Service from the Azure portal — data should persist.
- On Chrome/Edge, the "Install app" prompt should appear (PWA).

### 6. Microsoft sign-in (v2.3.0 and later)

Sign-in uses a Microsoft Entra app registration. Set it up once, in the [Azure portal](https://portal.azure.com/):

1. **Microsoft Entra ID → App registrations → New registration**:
   - Name: `FamilyPassportMap`;
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**;
   - Redirect URI: platform **Web**, `http://localhost:5173/api/auth/microsoft/callback` (local development).
2. From **Overview**, copy the **Application (client) ID**.
3. **Authentication → Web → Add URI**: `https://<app-name>.azurewebsites.net/api/auth/microsoft/callback`, then **Save**.
4. **Certificates & secrets → New client secret**. Copy its **Value** (not the Secret ID) straight away: it's shown only once. Secrets expire (24 months at most), and an expired secret makes every sign-in fail, so set a reminder to create a new one and update the app setting before then.
5. **Branding & properties**: set the home page URL (`https://<app-name>.azurewebsites.net`) and the privacy statement URL (`https://<app-name>.azurewebsites.net/privacy`), then **Save**.
6. Put the client ID and secret in the local `apps/server/.env` as `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` (with `APP_BASE_URL=http://localhost:5173`), and in the App Service settings from step 2.

The scopes (`openid email profile`) need no API-permission changes. Personal Microsoft accounts can sign in straight away. Some organizations block their members from consenting to apps from unverified publishers, so a work or school account may see "Need admin approval".

**Deploy order for v2.3.0:** add `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `APP_BASE_URL` and `LEGACY_DATA_OWNER_EMAIL` to the App Service **before** pushing the release to `main`. Without the first three, the new server refuses to start (by design). The deploy runs the new migrations on its own. Until the site owner (the `LEGACY_DATA_OWNER_EMAIL` account) first signs in, the People recorded before login exist but nobody can see them. That first sign-in Adopts them, and the owner can then use **Set as me** on the Person who is them.

## Architecture notes

- **Single App Service** runs one Node.js process that serves both the Express API (`/api/*`), the private photos (`/uploads/*`, only to a signed-in User who can view the photo's Person) and the Vite-built frontend (all other routes fall through to `index.html` for client-side routing).
- **SQLite** is safe because F1 tier is always a single instance — no concurrent writer risk.
- **No custom domain or SSL** on F1 tier — the default `*.azurewebsites.net` domain with Azure-managed HTTPS is used.
