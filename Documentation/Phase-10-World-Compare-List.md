# Phase 10 (v1.4.0) — World Compare & World List

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which places they've each visited. Each person (a `Person`: name, color, optional photo) gets a chosen color; visited places are filled in with that color on an interactive map. v1.x shipped **US states** with four pages (People, Map, Compare, List). There is no login/auth; it's a single-household tool hosted on Azure App Service (F1).

**Phases 8–11 add an independent country-tracking system on a world map**, as its own "World" section (→ v2.0.0). Phase 8 built the data layer/API; Phase 9 built the World section shell and the interactive World Map page. **This phase adds the two read-only World views — Compare and List — and surfaces country counts on the People page**, mirroring the US Compare (Phase 3) and List (Phase 4) pages.

## Carried over from previous phases

- **Monorepo**: `apps/server` (Express 5, Prisma 7, SQLite), `apps/web` (React 19, Vite, Tailwind 4, react-router-dom 7, PWA), `packages/shared` (`@familypassportmap/shared`).
- **Shared country data (Phase 8)**: `Continent` (Africa, Asia, Europe, North America, Oceania, South America), `CONTINENTS` (that alphabetical order), `COUNTRIES` (195 `{ code, numericCode, name, continent }`, alphabetical by name), `countriesByContinent(continent)` (keeps alphabetical order).
- **API (Phase 8)**: `GET /api/countries` → `{ personId, countryCodes }[]` for everyone in one call (people with no countries are simply absent). The web client wrapper is `getAllCountries()` in `apps/web/src/api/countries.ts` (Phase 9).
- **US Compare pattern (`ComparePage.tsx`)**: loads `listPeople()` + `getAllVisits()` together; a fieldset of person checkboxes (color dot + name), nothing selected by default; "Select people above to compare their maps." when none are; a `md:grid-cols-2` grid of cards, each with a heading (color dot, name, `StateCounter`) and a read-only `UsMap`.
- **US List pattern (`ListPage.tsx`)**: loads people + all visits; a responsive grid (`sm:grid-cols-2 lg:grid-cols-3`) of rows, one per state, each showing the state name and the `PersonAvatar` (24px) of every visitor. Includes the no-people state even though it's read-only.
- **Phase 9 World pieces**:
  - `WorldMap` (`view: WorldView = Continent | "World"`, read-only when `onToggleCountry` is omitted; fixed per-view projections).
  - `ContinentSelector` (controlled World + 6 continent pill buttons).
  - `WorldTabs` — the World sub-tab strip, currently **Map** only. New pages add their entry there and a route in `App.tsx`.
  - `StateCounter` takes `label` and `total` props: `<StateCounter count={n} total={COUNTRIES.length} label="countries" />`.
  - The World nav item is active on any `/world/*` path.
- **People page (`PeoplePage.tsx`)**: loads `listPeople()` + `getAllVisits()` in `refresh()`. Each row shows the name plus an "n/50 states" `StateCounter`. The delete confirmation reads "Their visited-state history will also be removed."

## Decisions made for this phase (with the user, 2026-09-16)

| Decision | Choice |
|---|---|
| World Compare zoom | **One shared `ContinentSelector`** above all cards (default **World**). Every card zooms together. |
| World List grouping | One section per continent, in `CONTINENTS` order, alphabetical within each (from the original plan). |
| People page | Shows **both** badges per person: "n/50 states" and "n/195 countries". |

## Detailed requirements

### `WorldComparePage` (`apps/web/src/pages/WorldComparePage.tsx`, route `/world/compare`)

A structural copy of `ComparePage`, with these differences:
- `WorldTabs` at the top; heading "World Compare". As on World Map, the tabs and heading stay visible in the no-people state.
- Loads `listPeople()` + `getAllCountries()`.
- Same person-checkbox fieldset and empty-selection hint.
- A `ContinentSelector` between the fieldset and the card grid, **shown only when at least one person is selected** (there's nothing to zoom otherwise). Its state is page-level and shared by every card; default `"World"`.
- Each card: heading with color dot, name, and "n/195 countries" counter (total count, not per-continent), then `<WorldMap view={view} visitedCountryCodes={…} color={person.colorHex} />` with **no** `onToggleCountry`. Compare is read-only; hover names still work.

### `WorldListPage` (`apps/web/src/pages/WorldListPage.tsx`, route `/world/list`)

A structural copy of `ListPage`, with these differences:
- `WorldTabs` at the top; heading "World List".
- Loads `listPeople()` + `getAllCountries()`.
- For each continent in `CONTINENTS`: an `<h2>` section header with the continent name and a muted count of its countries (e.g. "Africa · 54 countries"), followed by the same responsive row grid over `countriesByContinent(continent)`. Each row shows the country name and visitor avatars.
- No filtering, search, or collapse; all 195 rows render.

### Tabs and routes

- `WorldTabs`: `Map` (`/world/map`), `Compare` (`/world/compare`), `List` (`/world/list`), in that order.
- `App.tsx`: add the two routes.

### People page

- `refresh()` also loads `getAllCountries()`, in the same `Promise.all`.
- Each person row shows the existing states badge **and** a countries badge (`label="countries"`, `total={COUNTRIES.length}`). The badges sit together in a wrapping group so a long name plus two badges still fits a phone-width row.
- The delete confirmation text becomes: "Their visited states and countries will also be removed." (Cascade delete already removes both; the copy was state-only.)

## Out of scope for this phase

- Micro-state click targets (Tuvalu has no polygon; a handful of countries are only a few pixels wide) — Phase 11. Since Compare and List are read-only, the gap only affects *marking* countries on the World Map page.
- Per-continent completion stats; blended/overlap coloring; search/filter on the list; auth.
- Any server, schema, or US-page change beyond the People page items above.

## Acceptance criteria

- World sub-tabs show Map / Compare / List on all three World pages; the active tab is underlined, and the World nav item stays active.
- World Compare: selecting people shows one read-only world map card each, in their color, with correct country counters. Changing the continent re-frames every card at once. Clicking a country on a card changes nothing.
- World List: 6 continent sections in order, with 54/47/45/23/14/12 rows, alphabetical within each, and avatars on exactly the countries each person has marked.
- People page shows both counters, and they match the US and World pages. The delete confirmation mentions countries.
- `npm run build` passes; the server test suite passes unchanged.

## Decisions to carry forward to Phase 11

- The three World pages exist and all use `WorldMap`. Only `WorldMapPage` passes `onToggleCountry`, so micro-state markers must respect the same rule: clickable only with a handler **and** a continent view; visible (in the person's color when visited) on read-only maps too, so Compare shows tiny visited countries.
- `ContinentSelector` state lives in each page, not globally (switching between World tabs resets to World).
- People page loads both bulk endpoints on every `refresh()`.
