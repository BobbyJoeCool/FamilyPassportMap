# Phase 0 — Environment & Tech Stack Setup

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

None — this is the first phase. It exists to establish the decisions every later phase inherits.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states are filled in with that color on an interactive US map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all 50 states with icons showing who's visited each one.

- **v1.0.0 scope is US states only.** Countries and a world map are explicitly future scope — do not shape the data model or naming around "state" as a generic "region" abstraction; keep it concrete and simple for now.
- **No login/auth in v1.** This is a single-household, unauthenticated tool — anyone with the URL can view and edit. (This was a deliberate trade-off to avoid scope creep in v1, not an oversight.)
- **No blended/overlap coloring in v1.** When comparing multiple people, v1 renders separate maps side by side rather than one map with combined colors for overlapping states. Blending is a possible future enhancement, not part of v1.
- It's a responsive, installable **PWA** — must work well on phone, tablet, and desktop, not just desktop.
- Original concept considered an Electron desktop app; that was dropped in favor of a hosted web app to keep things simple and free to run.

## Tech stack (decided, not up for reinterpretation in later phases)

- **Frontend:** React + TypeScript, built with Vite. Tailwind CSS for styling (introduced in Phase 5, but the frontend framework choice is locked now).
- **Backend:** Node.js + TypeScript, using Express.
- **Database:** SQLite, accessed via Prisma ORM.
- **Hosting:** Azure App Service, **Free (F1) tier** — this is a hard budget constraint, not a placeholder. The user does not want to pay for hosting.
- **Map rendering:** `react-simple-maps` with a US states TopoJSON source (e.g. `us-atlas`), decided at Phase 2 but flagged here so Phase 0 tooling can include it if convenient.

### Why the free-tier constraint matters architecturally

Azure App Service's Free (F1) plan:
- Only ever runs a **single instance** (no scale-out). This is actually useful: it avoids SQLite's multi-writer problem, since there's never more than one process touching the database file.
- Persists its `/home` directory across restarts and redeploys (it's backed by Azure Storage under the hood). The truly ephemeral disk on App Service is `/tmp`, not `/home`.
- Has a limited daily compute quota and no custom domain/SSL/autoscaling — acceptable trade-offs for a personal family tool.

**Consequence for this phase:** the SQLite database file and any uploaded profile pictures must be designed from day one to live under a configurable data directory (an environment variable, e.g. `DATA_DIR`) that points at `./data` in local dev and at a path under `/home` (e.g. `/home/data`) in production on Azure. Don't hardcode a path relative to the app's deployment folder — that folder gets overwritten on every redeploy.

## Goals for this phase

Stand up the monorepo skeleton, tooling, and hosting groundwork so every later phase has a working foundation to build actual features into. No user-facing functionality is expected to exist at the end of this phase.

## Detailed requirements

1. **Monorepo layout**, using npm workspaces (not pnpm/yarn/Turborepo/Nx — keep tooling minimal for a solo project):
   ```
   FamilyPassportMap/
   ├── package.json            # root workspaces config + shared scripts
   ├── tsconfig.base.json      # shared TS compiler options
   ├── apps/
   │   ├── server/             # Express + TS API
   │   └── web/                # React + TS frontend (Vite)
   └── packages/
       └── shared/             # shared TS types/validation, imported by both apps
   ```
2. **TypeScript** configured in all three packages, extending the shared base config.
3. **Linting/formatting**: ESLint + Prettier configured at the root, applied consistently across `apps/*` and `packages/*`.
4. **Prisma** initialized inside `apps/server` with the SQLite provider. `schema.prisma` can be left with no models yet (models are Phase 1's job) but the `DATA_DIR`-based database URL convention should be wired up now — e.g. `DATABASE_URL="file:${DATA_DIR}/app.db"` resolved via an env var, not a hardcoded relative path.
5. **Express skeleton** in `apps/server`: a minimal server exposing `GET /api/health` returning `200 OK`. This is also where, eventually (Phase 6), the built frontend gets served as static files — keep that in mind when structuring `src/index.ts`, but don't build it yet.
6. **Vite React TS skeleton** in `apps/web`: default starter page only, no custom UI yet.
7. **Root `package.json` scripts**: `dev` (runs `server` and `web` concurrently), `build` (builds all workspaces), `lint`.
8. **VS Code workspace config**: `.vscode/settings.json` and `.vscode/extensions.json` recommending the relevant extensions (ESLint, Prettier, Prisma, Tailwind CSS IntelliSense) so formatting is consistent without manual setup.
9. **GitHub Actions CI skeleton**: a workflow that runs `npm install`, `npm run lint`, and `npm run build` on push/PR. The actual Azure deploy step is Phase 6's job — this phase only needs a build/lint check.
10. **Azure resource provisioning (manual, outside Claude Code's access)**: document the exact one-time steps the user needs to do themselves, since Claude Code has no Azure credentials or CLI access in this environment:
    - Create a Linux App Service on the **F1 (Free)** pricing tier, Node 24 runtime (the current Active LTS at build time — Node 20 has reached end-of-life; use whichever Node LTS Azure offers that matches `apps/server/package.json`'s `engines.node` at the time Phase 6 is actually built).
    - Note the app name/region chosen (needed by Phase 6).
    - Confirm "Always On" is off (it isn't available on F1 anyway, but worth confirming expectations).

## Out of scope for this phase

No data model, no UI features, no map, no deployment automation — just plumbing. Don't jump ahead to Phase 1's schema or Phase 2's map library integration even if it seems convenient to bundle in.

## Acceptance criteria

- `npm install && npm run dev` starts both `apps/server` and `apps/web` locally with no errors.
- `GET /api/health` (on the server's local port) returns `200 OK`.
- The Vite dev server renders the default starter page with no console errors.
- `npm run build` succeeds across all workspaces.
- `npm run lint` runs cleanly against the (currently minimal) codebase.

## Decisions to carry forward to Phase 1

- **Monorepo paths are fixed**: `apps/server`, `apps/web`, `packages/shared`. Every later phase's file references assume this layout.
- **Package manager is npm workspaces** — don't introduce pnpm/yarn/Turborepo later without updating this decision everywhere.
- **`DATA_DIR` env var convention** for anything written to disk (SQLite file, later uploaded photos) — defaults to a local `./data` folder in dev; Phase 1 must follow this convention for the database file, and will need to extend it for uploaded photos.
- **Node version target: Node 24 (current Active LTS)**, to keep local dev and Azure's runtime in sync. (Originally targeted Node 20 LTS during initial design; corrected during actual Phase 0 build once it was confirmed Node 20 had already reached end-of-life and the local dev machine was already on Node 24 — see `DevNotes/Notes/v0.0.note.md`. Whatever's current Active LTS when a later phase revisits this should win over this specific number.)
- **Azure resource details** (app name, region) established during manual provisioning — record the actual values once known; Phase 6 needs them.
