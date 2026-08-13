# Phase 2 (v0.2.0) — Interactive Map (Single-Person View)

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phase 0:
- Monorepo layout: `apps/server`, `apps/web`, `packages/shared`. `DATA_DIR` convention for anything written to disk.

From Phase 1:
- `Person { id, name, colorHex, profilePicturePath?, createdAt }` and `VisitedState { id, personId, stateCode, visitedAt }` (unique on `personId`+`stateCode`, cascade-deletes with `Person`) exist in the Prisma schema.
- Full CRUD API for people exists (`GET/POST/PATCH/DELETE /api/people`, `POST /api/people/:id/photo`), plus a People management page in `apps/web`.
- `stateCode` uses 2-letter USPS codes.
- Shared types/validation live in `packages/shared`.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states are filled in with that color on an interactive US map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all 50 states with icons showing who's visited each one. v1.0.0 covers US states only. There is no login/auth in v1. It's a responsive, installable PWA built with React + TypeScript (Vite) + Tailwind CSS, Node.js + TypeScript (Express), Prisma + SQLite, hosted on Azure App Service's free (F1) tier.

## Goals for this phase

Build the core interaction of the whole app: pick a person, click states on a map, see them fill in with that person's color, and have it persist.

## Detailed requirements

### Map library

Add `react-simple-maps` to `apps/web`, plus a US states TopoJSON data source (e.g. the `us-atlas` package's `states-10m.json`, or an equivalent bundled/fetched topology). Each state's geography data must map cleanly to the 2-letter USPS `stateCode` convention already established — build (or find) a lookup between the map data's state identifiers (often FIPS codes) and USPS codes if the chosen data source doesn't use USPS codes natively.

### API routes (`apps/server`)

- `GET /api/people/:id/visits` — returns the list of `stateCode`s that person has visited.
- `PUT /api/people/:id/visits/:stateCode` — marks a state visited for that person (idempotent — calling it twice is not an error).
- `DELETE /api/people/:id/visits/:stateCode` — unmarks a state.

### Frontend — Map page

- A person selector (dropdown or tabs) populated from the existing People list (Phase 1's API).
- The US map renders with all 50 states. States the selected person has visited are filled with that person's `colorHex`; unvisited states use a neutral default fill (e.g. light gray).
- Clicking a state toggles its visited status for the currently selected person, calling the visits API, and updates the fill color immediately (optimistic update is fine, but must reconcile if the API call fails).
- Basic hover/active affordance (cursor pointer, slight highlight on hover) so it's visually clear states are clickable. Exact hover styling isn't specified — use a reasonable default; Phase 5 handles final visual polish.
- Build the map as its own reusable component (e.g. `UsMap`) rather than inlining it into the page — Phase 3's Compare view reuses this same component.

## Out of scope for this phase

- Compare view, List view.
- Mobile-specific layout polish (must be functional on all screen sizes, but dedicated responsive design work is Phase 5).
- PWA installability (Phase 5).
- Deployment (Phase 6).

## Acceptance criteria

- Selecting a person and clicking an unvisited state marks it visited (fills with their color) and persists via the API.
- Clicking an already-visited state unmarks it.
- Reloading the page preserves the visited states shown (confirms round-trip through the API/DB, not just local state).
- Switching the selected person shows that person's own visited states, not the previous person's.

## Decisions to carry forward to Phase 3

- **Visits API shape** (`GET /api/people/:id/visits` → `string[]` of state codes, `PUT`/`DELETE /api/people/:id/visits/:stateCode`, both mounted via `visitsRouter` at `/api/people/:id/visits` with `mergeParams: true`) — Phase 3 will add a bulk "all people's visits" endpoint alongside this, not replace it.
- **Map library and data source, as actually built**: `react-simple-maps@3.0.0` + `us-atlas`'s `states-10m.json`. Its peer-dependency range doesn't yet cover React 19 (installed with `--legacy-peer-deps`; confirmed working correctly at runtime and in the build) and it also needs `prop-types` as an explicit dependency, not just a peer — both already installed in `apps/web`. The FIPS↔USPS mapping needed no runtime lookup logic: `us-atlas`'s topology already uses zero-padded 2-digit FIPS strings as each geography's `id` (e.g. `"06"` for California), so `packages/shared/src/usStates.ts` just exports a static `FIPS_TO_USPS` record plus the canonical `US_STATES`/`US_STATE_CODES` list (50 states only — DC and territories are present in the topology's 56 geometries but intentionally left out of the map, rendered in a fixed neutral color and non-interactive, since they're out of v1 scope).
- **`UsMap` is a shared, reusable component** (`apps/web/src/components/UsMap.tsx`) — takes `visitedStateCodes`, `color`, and an optional `onToggleState` (omitting it makes the map read-only). Phase 3 renders multiple read-only instances of it side by side rather than building a second map implementation.
- **`d3-color` pinned via a root `package.json` `overrides` entry** (`^3.1.0`) to patch a high-severity ReDoS advisory in a version pulled in transitively by `react-simple-maps`'s own `d3-transition`/`d3-zoom` dependencies — worth knowing about if `react-simple-maps` is ever upgraded or replaced, since the override can likely be removed at that point.
