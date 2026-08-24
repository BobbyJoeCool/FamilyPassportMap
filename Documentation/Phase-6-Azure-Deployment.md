# Phase 6 (v0.6.0) — Azure Deployment Pipeline

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phase 0:
- `DATA_DIR` env var convention: everything written to disk (SQLite database file, uploaded photos) is rooted under `DATA_DIR`, which defaults to a local `./data` folder in dev. This phase is where `DATA_DIR` finally gets pointed at a real, persistent production location.
- Azure resource provisioning is manual — Claude Code has no Azure credentials/CLI access. The user provisions the App Service themselves; record the actual app name/region/resource group here once known.

From Phase 1:
- Uploaded photos live under `DATA_DIR/uploads/`.

From Phases 1–5:
- Fully working app: People, Map, Compare, List pages, responsive, installable as a PWA. `apps/server` (Express) and `apps/web` (Vite/React) are separate workspaces in the monorepo.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states fill in with that color on an interactive US map, with Compare (side-by-side) and List views also available. v1.0.0 covers US states only. There is no login/auth in v1. Tech stack: React + TypeScript (Vite) + Tailwind CSS frontend, Node.js + TypeScript (Express) backend, Prisma + SQLite database.

**Hard constraint: Azure App Service Free (F1) tier, and the user does not want to pay for hosting.** This shapes every decision in this phase:
- F1 only ever runs a **single instance** — no scale-out. This is relied on to keep SQLite safe (no multi-writer conflicts), so nothing in this phase should introduce a second instance or a scaling rule.
- F1 persists the `/home` directory across restarts/redeploys (backed by Azure Storage). The genuinely ephemeral disk is `/tmp` — never point `DATA_DIR` there.
- F1 has no custom domain/SSL, no autoscaling, no staging deployment slots, and a limited daily compute quota. All acceptable trade-offs for a personal family tool; don't design around features F1 doesn't have.
- Running two App Services (one for `apps/server`, one for `apps/web`) would either cost money or double the free-tier footprint unnecessarily — this phase deploys **one** App Service that serves both the API and the built frontend.

## Goals for this phase

Get the app live on Azure's free tier, with data that survives restarts and redeploys, deployed automatically via CI on every push to `main`.

## Detailed requirements

### Single-service serving

- `apps/server`'s Express app, in production, also serves `apps/web`'s built static output (e.g. serves `apps/web/dist` as static files for any non-`/api` route) so one running Node process handles everything. Confirm this doesn't conflict with the PWA service worker's expected file locations from Phase 5.

### Persistent storage

- In production, `DATA_DIR` is set via Azure App Service application settings to a path under the persistent `/home` directory (e.g. `/home/data`). This must hold both the SQLite database file and the `uploads/` folder from Phase 1.
- Confirm after first deploy that a restart (via the Azure portal or CLI) does not wipe the database or uploaded photos.

### CI/CD

- Add `.github/workflows/azure-deploy.yml`: on push to `main`, install dependencies, build all workspaces (`apps/web` then `apps/server`, since the server serves the web build), and deploy to the App Service using the `azure/webapps-deploy` GitHub Action.
- The deploy step needs the App Service's publish profile stored as a GitHub Actions secret — this is part of the manual setup below, not something Claude Code can create itself.

### Manual one-time setup (user does this outside Claude Code)

Document these steps clearly for the user, since none of this can be done from within the repo:
1. Create a Linux App Service on the **F1 (Free)** pricing tier, matching the Node LTS version `apps/server/package.json`'s `engines.node` targets at the time this phase is built (Node 24 as of Phase 0 — see `Documentation/Phase-0-Environment-Setup.md`). Record the app name and region once created.
2. In the App Service's Configuration settings, add an application setting `DATA_DIR=/home/data`.
3. Download the App Service's publish profile and add it as a GitHub repository secret (e.g. `AZURE_WEBAPP_PUBLISH_PROFILE`) for the deploy workflow to use.

## Out of scope for this phase

- Custom domain/SSL (not available on F1).
- Autoscaling, staging slots (not available on F1).
- Monitoring/alerting/observability tooling — not requested, would add cost/complexity beyond v1's needs.

## Acceptance criteria

- Pushing to `main` triggers a deploy automatically via GitHub Actions.
- The live Azure URL serves the full app — People, Map, Compare, List all work exactly as they do locally.
- Creating a person and marking a state visited on the live site persists across an App Service restart.
- The app is installable as a PWA from the live Azure URL (confirms the PWA manifest/service worker work correctly when served from Express in production, not just Vite's dev server).

## Decisions to carry forward to Phase 7

- **Production `DATA_DIR` path**: `/home/data` (set via Azure App Service application settings). The SQLite DB and `uploads/` folder live here. This persists across restarts and redeploys.
- **Deploy trigger is push-to-`main`** via `.github/workflows/azure-deploy.yml` — uses `azure/webapps-deploy@v3` with publish profile stored as `AZURE_WEBAPP_PUBLISH_PROFILE` secret and app name as `AZURE_WEBAPP_NAME` variable.
- **Production serving**: Express serves the Vite-built frontend (`apps/web/dist`) as static files for non-API routes when `NODE_ENV=production`. Root `npm start` runs `NODE_ENV=production node apps/server/dist/index.js`.
- **Manual setup guide**: `Documentation/AZURE-SETUP.md` documents the one-time Azure provisioning steps (App Service creation, env vars, publish profile, startup command).
- **Live URL**: `https://<app-name>.azurewebsites.net` — record the actual app name here once provisioned by the user.
