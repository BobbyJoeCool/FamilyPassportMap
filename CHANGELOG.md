# Changelog

All notable changes to this project are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows the phase plan in [`PHASES.md`](PHASES.md): each build phase ships as `0.x.0`, culminating in `1.0.0` once every phase is built and stabilized.

## [Unreleased]

- **Fixed: Azure deploy workflow failed on every run.** The workflow expected an `AZURE_WEBAPP_PUBLISH_PROFILE` secret that was never added, so `azure/webapps-deploy` had no credentials ("No credentials found").
  - The workflow now signs in with **OIDC** (`azure/login` + a federated credential), so no password or publish profile is stored and SCM basic auth stays off.
  - It fails fast with a clear message if the `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` repository variables are missing.
  - The app name falls back to `family-passport-map`.
  - Removed `startup-command`, which the action rejects with publish-profile auth; it's already set in the App Service.
  - `Documentation/AZURE-SETUP.md` gives the correct startup command (`bash startup.sh`, not `npm start`) and the one-time OIDC setup commands.

## [2.2.0] — 2026-09-16 — Navigation: People / US / World

- **Top menu is now People | US | World.** The US Map / Compare / List pages are no longer top-level items. US and World each have the same **Map / Compare / List** tab strip underneath (`SectionTabs`, which replaces the World-only `WorldTabs`). The top menu and the phone's bottom bar each show three items.
- **Switching sections keeps your tab**: US Compare → World Compare, World List → US List. Coming from People opens Map.
- **US pages moved to `/us/map`, `/us/compare`, `/us/list`** to match `/world/*`, and are now titled US Map / US Compare / US List. The old `/map`, `/compare`, `/list` URLs redirect, and `/` still opens the US map.

## [2.1.0] — 2026-09-16 — Map Legibility

- **Darker borders**: state and country borders on both the US and world maps are now medium gray (`MAP_BORDER` in `apps/web/src/components/mapStyles.ts`) instead of white, so they stand out against the light-gray "not visited" fill.
- **Country codes on the world map**: every country is labeled with its ISO 3166-1 alpha-3 code (FRA, DEU, USA):
  - **World overview**: very small print, only on countries big enough to hold their code, with bigger countries winning when codes would overlap.
  - **Continent view**: slightly larger print on every country of that continent. Countries too small to hold their code get the small print instead. Neighboring countries are labeled only where their code fits without overlapping.
  - **Micro-states**: the 29 marker dots show their code beside the dot.
- **Shared data**: `Country` gains an `alpha3` field for all 195 countries, cross-checked against the ISO table's alpha-2 and numeric codes, with a new uniqueness/format test (43 tests total).

## [2.0.0] — 2026-09-16 — World Release

Stabilization pass over Phase 11, completing the World round (Phases 8–11). No new features. Walked every US and World page end to end locally (desktop and phone widths, light and dark), confirmed each phase's acceptance criteria still hold, and synced all documentation to match what shipped.

- **Countries on a world map**, alongside the existing US states: a 🌍 World section with Map (continent zoom, click to mark), Compare (side by side, shared continent view), and List (grouped by continent) — covering all 195 UN member and observer states, tracked independently of US states.
- **Docs**: README intro, feature list, and project-structure links updated for countries (including the `CLAUDE.md` link, which now points into `.claude/`); `PHASES.md` versioning convention covers the World round.

## [1.5.0] — 2026-09-16 — World Polish & Hardening (Phase 11)

- **Every country is now clickable**: 29 micro-states and scattered archipelagos (too small to click as polygons in their continent view, plus Tuvalu, which has no polygon at all) get a dot at their capital when the map is zoomed to their continent. Dots follow the same hover, click, and read-only rules as polygons and fill with the person's color when visited. The seven Lesser Antilles dots fan out into a column with connector lines so they don't overlap.
- **Code-splitting**: the World pages are lazy-loaded, so the world topology no longer weighs down the US pages (main JS chunk 1,330 kB → 556 kB).
- **Copy**: the PWA manifest and package descriptions now mention countries.

Full scope and acceptance criteria: [`Documentation/Phase-11-World-Polish-Hardening.md`](Documentation/Phase-11-World-Polish-Hardening.md)

## [1.4.0] — 2026-09-16 — World Compare & World List (Phase 10)

- **World Compare** (`/world/compare`): pick people to see their world maps side by side, read-only, each in their own color with an "n/195 countries" counter. One shared continent selector zooms every card together.
- **World List** (`/world/list`): all 195 countries in six continent sections (with per-section counts), alphabetical within each, with visitor avatars on each row.
- **World sub-tabs** now show Map / Compare / List.
- **People page**: each person shows both "n/50 states" and "n/195 countries" badges. The delete confirmation now mentions that visited countries are removed too.

Full scope and acceptance criteria: [`Documentation/Phase-10-World-Compare-List.md`](Documentation/Phase-10-World-Compare-List.md)

## [1.3.0] — 2026-09-16 — World Map (Phase 9)

The first World UI: a new **World 🌍** section with an interactive world map, zoomable by continent.

- **Navigation**: a 5th top-level nav item, World (`/world` → `/world/map`), highlighted on every `/world/*` route, plus a World-section sub-tab strip (`WorldTabs`).
- **`WorldMap` component**: `world-atlas` 50m countries on an Equal Earth projection. Seven fixed views: the World overview (view-only) and one per continent. Each continent view uses its own rotated, fitted projection, so Oceania stays contiguous across the antimeridian. Tracked countries show a hover name pill; untracked territories render as inert gray.
- **`WorldMapPage`**: person selector, "n/195 countries" counter, `ContinentSelector` (World + 6 continents), click-to-toggle with optimistic update and rollback.
- **Reuse**: `StateCounter` gained `label` and `total` props for the countries variant; new `api/countries.ts` client.
- **Dependency**: `world-atlas@2.0.2`.

Full scope and acceptance criteria: [`Documentation/Phase-9-World-Map.md`](Documentation/Phase-9-World-Map.md)

## [1.2.0] — 2026-09-16 — World Data Layer & Countries API (Phase 8)

First of four phases adding country tracking on a world map (→ v2.0.0). Backend and shared data only — no UI yet.

- **Schema**: new `VisitedCountry` model (migration `20260916173026_add_visited_country`), a parallel copy of `VisitedState` keyed by ISO 3166-1 alpha-2 code, cascade-deleted with its `Person`. Purely additive; existing data is untouched. Country and state tracking are fully independent.
- **Shared data**: `packages/shared/src/countries.ts` — 195 countries (193 UN members + Vatican City and Palestine), each with alpha-2 code, ISO numeric code, name, and one of 6 continents; plus `CONTINENTS`, `COUNTRY_CODES`, `ISO_NUMERIC_TO_ALPHA2` (derived), and `countriesByContinent()`. Verified against the `world-atlas` 50m topology.
- **API**: `GET/PUT/DELETE /api/people/:id/countries[/:countryCode]` and bulk `GET /api/countries`, mirroring the visits endpoints.
- **Tests**: 19 new tests (42 total), including country/state independence and cascade delete.

Full scope and acceptance criteria: [`Documentation/Phase-8-World-Data-Layer.md`](Documentation/Phase-8-World-Data-Layer.md)

## [1.1.0] — 2026-09-16 — Visited-State Counter

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
