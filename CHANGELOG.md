# Changelog

All notable changes to this project are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows the phase plan in [`PHASES.md`](PHASES.md): each build phase ships as `0.x.0`, culminating in `1.0.0` once every phase is built and stabilized.

## [Unreleased]

- **Visited-state counter**: an "n/50 states" badge (`StateCounter` component) next to each person on the People, Map, and Compare views, backed by the existing visits API — no schema or API changes. See `PHASES.md` (v1.1.0 row).

## [1.0.0] — 2026-08-24 — Official Release

Stabilization pass over Phase 7. No new features — confirmed all acceptance criteria hold end-to-end, synced all documentation to match what actually shipped, bumped to v1.0.0.

## [0.7.0] — 2026-08-24 — Polish, Validation & Hardening

The last build phase before v1.0.0 — hardens everything from Phases 1–6 without adding new features.

- **Client-side validation**: Person form validates name (required), color (must be chosen), and photo (type + size) inline before submit, with red borders and specific error messages
- **Delete confirmation**: Deleting a person now shows an inline confirmation with cascade-delete warning ("Their visited-state history will also be removed") before executing
- **Empty states**: List page now shows "No one added yet" prompt when no people exist (Map and Compare already had this)
- **Loading & error states**: All four pages audited — every API call has visible loading and error feedback
- **API test suite**: 23 automated tests (Vitest + Supertest) covering people CRUD and visits CRUD, including validation failures, 404s, cascade delete, idempotency, and state-code normalization
- **Refactored**: Express app extracted into `apps/server/src/app.ts` for test importability; `index.ts` is now just the listener

Full scope and acceptance criteria: [`Documentation/Phase-7-Polish-Hardening.md`](Documentation/Phase-7-Polish-Hardening.md)

## [0.6.0] — 2026-08-24 — Azure Deployment Pipeline

Everything needed to deploy the app to Azure App Service's free tier.

- Express serves the Vite-built frontend in production (`NODE_ENV=production`), so one App Service handles both API and web
- GitHub Actions workflow (`.github/workflows/azure-deploy.yml`): build + deploy to Azure on every push to `main`
- Root `npm start` script for Azure startup
- Manual setup guide: [`Documentation/AZURE-SETUP.md`](Documentation/AZURE-SETUP.md) — App Service creation, `DATA_DIR` env var, publish profile secret

Full scope and acceptance criteria: [`Documentation/Phase-6-Azure-Deployment.md`](Documentation/Phase-6-Azure-Deployment.md)

## [0.5.0] — 2026-08-24 — Responsive Design & PWA Packaging

The app now looks and works well on phone, tablet, and desktop, and is installable as a PWA.

- Tailwind CSS v4 added via `@tailwindcss/vite` — all pages restyled with responsive utility classes and CSS custom property theming (light + dark mode)
- Responsive navigation: bottom tab bar with icons on mobile, horizontal top nav on desktop
- Compare page stacks maps vertically on mobile, side by side on desktop
- List page: single column on mobile, 2-column on tablet, 3-column on desktop
- PWA: `vite-plugin-pwa` with web app manifest, 192/512px icons, service worker for offline shell caching
- Default route changed from `/people` to `/map`

Full scope and acceptance criteria: [`Documentation/Phase-5-Responsive-PWA.md`](Documentation/Phase-5-Responsive-PWA.md)

## [0.4.0] — 2026-08-23 — List View

All 50 states in one scannable list, with avatar icons showing who's visited each one.

- Web UI: List page — alphabetical table of all 50 US states, each row showing `PersonAvatar` icons for every person who has visited that state (photo if uploaded, colored-circle-with-initials fallback otherwise)
- No new backend endpoints — reuses `GET /api/visits` (Phase 3) and `GET /api/people` (Phase 1)

Full scope and acceptance criteria: [`Documentation/Phase-4-List-View.md`](Documentation/Phase-4-List-View.md)

## [0.3.0] — 2026-08-23 — Compare View (Side-by-Side)

Select multiple people and see their maps rendered next to each other for easy visual comparison.

- API: `GET /api/visits` — bulk endpoint returning all visited states grouped by person (`{ personId, stateCodes[] }[]`), used by Compare (and later List) views to avoid per-person fetches
- Web UI: Compare page — multi-select checkboxes for people, side-by-side read-only `UsMap` instances colored per-person, deselect to remove a map

Full scope and acceptance criteria: [`Documentation/Phase-3-Compare-View.md`](Documentation/Phase-3-Compare-View.md)

## [0.2.0] — 2026-08-13 — Interactive Map (Single-Person View)

The core interaction of the whole app: pick a person, click states, watch them fill in.

- API: `GET /api/people/:id/visits`, `PUT`/`DELETE /api/people/:id/visits/:stateCode` — idempotent, validated against the real 50-state list
- Shared canonical US states list + FIPS↔USPS mapping in `packages/shared`
- Web UI: Map page — person selector, click-to-toggle US map (`react-simple-maps`), colored per-person, persists immediately with optimistic UI and failure reconciliation

Full scope and acceptance criteria: [`Documentation/Phase-2-Interactive-Map.md`](Documentation/Phase-2-Interactive-Map.md)

## [0.1.0] — 2026-08-12 — Data Layer & People Management

First functional release. No map, compare, or list views yet — this release lays the data foundation everything else builds on.

- Prisma schema: `Person` and `VisitedState` models on SQLite, with cascade delete
- API: full CRUD for people (`GET/POST/PATCH/DELETE /api/people`)
- API: profile-picture upload (`POST /api/people/:id/photo`) — JPEG/PNG/WebP, 5MB max, served statically from `/uploads`
- Shared TypeScript types/validation for `Person` in `packages/shared`
- Web UI: People management page — add, edit, and delete a family member with a required color and an optional profile picture

Full scope and acceptance criteria: [`Documentation/Phase-1-Data-Layer-People.md`](Documentation/Phase-1-Data-Layer-People.md)

## [0.0.0] — Phase 0 — Environment & Tech Stack Setup

No user-facing behavior. Monorepo scaffolding (npm workspaces: `apps/server`, `apps/web`, `packages/shared`), Express + Prisma/SQLite skeleton, Vite + React skeleton, ESLint/Prettier, CI (lint + build on push/PR).

Full scope: [`Documentation/Phase-0-Environment-Setup.md`](Documentation/Phase-0-Environment-Setup.md)
