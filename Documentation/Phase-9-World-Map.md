# Phase 9 (v1.3.0) — World Map (Continent Zoom)

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which places they've each visited. Each person gets a chosen color; visited places are filled in with that color on an interactive map. v1.x shipped **US states only** with four pages — People, Map, Compare, List. There is no login/auth; it's a single-household tool hosted on Azure App Service (F1).

**Phases 8–11 add a second, independent tracking system: countries visited, on a world map**, navigated by zooming to one continent at a time, as its own "World" section. Phase 8 built the data layer and API. **This phase builds the first UI for it: the World section shell and the interactive World Map page.**

Everyone tracked is a `Person`; there is no separate user-vs-family-member concept.

## Carried over from previous phases

- **Monorepo**: `apps/server` (Express 5 + Prisma 7 + SQLite), `apps/web` (React 19 + Vite + Tailwind 4 + react-router-dom 7, installable PWA), `packages/shared` (types/data imported as `@familypassportmap/shared`).
- **US map pattern (Phase 2)**: `apps/web/src/components/UsMap.tsx` uses `react-simple-maps@3` (`ComposableMap` / `Geographies` / `Geography`) with `us-atlas/states-10m.json`, bridges TopoJSON ids to database codes via `FIPS_TO_USPS`, renders untracked shapes (DC/territories) as a flat inert gray, fills visited states in the person's color, shows a floating name "pill" on hover, and is read-only when `onToggleState` is omitted.
- **Map page pattern**: `MapPage.tsx` — a person `<select>`, a `StateCounter` badge ("n/50 states"), and `UsMap`. Clicking toggles with an **optimistic update**, and on failure shows the error and re-fetches the true list.
- **App shell**: `App.tsx` holds `NAV_ITEMS` (People, Map, Compare, List), rendered as a desktop top nav and a mobile bottom tab bar; `/` redirects to `/map`.
- **Phase 8 data layer (v1.2.0)**:
  - `VisitedCountry` model (`personId`, `countryCode` ISO 3166-1 alpha-2, unique per person, cascade-deleted). Fully independent of `VisitedState`.
  - `packages/shared/src/countries.ts`: `Continent` (6 values), `CONTINENTS` (alphabetical), `Country { code, numericCode, name, continent }`, `COUNTRIES` (195, alphabetical), `COUNTRY_CODES`, `ISO_NUMERIC_TO_ALPHA2` (derived), `countriesByContinent()`.
  - API: `GET /api/people/:id/countries` → `string[]`; `PUT` / `DELETE /api/people/:id/countries/:countryCode` → 204 (idempotent; 400 unknown code; 404 unknown person); `GET /api/countries` → `{ personId, countryCodes }[]`.
  - Topology facts (`world-atlas@2.0.2` `countries-50m.json`): 241 geometries; 194/195 tracked countries have a polygon (Tuvalu has none); 42 geometries are untracked background; 5 geometries have **no id**; id `036` is shared by two geometries (both → `AU`). Keys must not rely on `id`.

## Decisions made for this phase (with the user, 2026-09-16)

| Decision | Choice |
|---|---|
| Navigation | One new 5th top-level nav item, **World 🌍** → `/world` (redirects to `/world/map`). Inside the World section, a small **Map / Compare / List** sub-tab strip. |
| Continent zoom trigger | A button selector above the map: **World** (overview, default) plus the 6 continents. |
| World overview | Visual overview only — **not clickable**. Hover names still show. |
| Countries outside the selected continent | Still **clickable** if visible. The continent only sets the viewport; it doesn't filter interactivity. Visited countries show the person's color everywhere. |
| Compare zoom (Phase 10) | A shared continent selector above all cards — so the selector must be a reusable component. |

## Detailed requirements

### Dependency

Add `world-atlas@2.0.2` to `apps/web` and import `world-atlas/countries-50m.json` (TopoJSON, object `countries`, each geometry's `id` = ISO 3166-1 numeric string, `properties.name` = Natural Earth name).

### `WorldMap` component (`apps/web/src/components/WorldMap.tsx`)

```ts
export type WorldView = Continent | "World";

interface WorldMapProps {
  visitedCountryCodes: string[];
  color: string;
  view: WorldView;
  /** Omit for a read-only map. Ignored when view === "World". */
  onToggleCountry?: (countryCode: string) => void;
}
```

- **Projection**: `geoEqualEarth`, in a fixed 800×500 SVG frame for every view (so switching continents never changes the map's height on the page).
- **Viewports are fixed, not free pan/zoom.** Each view is defined as a longitude/latitude bounding box. At module load, one d3 projection is built per view: rotated so the box's center longitude is the central meridian, then `fitExtent`-ed to the frame with a small padding. The projection instance is passed straight to `ComposableMap`'s `projection` prop (react-simple-maps v3 accepts a function).
  - Why rotate rather than `ZoomableGroup`: Oceania straddles the antimeridian. A zoom/translate of an unrotated world map would split Fiji/Samoa/Tonga/Kiribati to the opposite edge. Rotation keeps each continent contiguous, and because nothing is CSS/SVG-scaled, stroke widths stay crisp at every zoom.
  - No drag-to-pan or pinch-zoom: keeps mobile page scrolling predictable and every view consistent.
  - Starting boxes (`[west, south, east, north]`, east may exceed 180 to cross the antimeridian), tuned visually during the build: World = whole sphere; Africa `[-20, -36, 53, 38]`; Asia `[25, -12, 150, 56]`; Europe `[-25, 34, 45, 71]`; North America `[-170, 6, -52, 72]`; Oceania `[110, -48, 190, 14]`; South America `[-82, -56, -34, 13]`. The final values live in the component's `VIEWPORTS` table.
- **Fill**: tracked + visited → `color`; tracked + not visited → light gray; untracked (no id, or id not in `ISO_NUMERIC_TO_ALPHA2`) → a lighter inert gray with no hover or click.
- **Hover**: tracked countries show the same floating name pill as `UsMap` (name from `COUNTRIES`, not from the topology's `properties.name`), in every view including World.
- **Click**: calls `onToggleCountry(alpha2)` only when `onToggleCountry` is provided **and** `view !== "World"`. Cursor is `pointer` only in that case.
- **Keys**: `geo.rsmKey` (unique per geometry), never `geo.id`.
- **No country labels** (out of scope; 195 labels at varying zoom is a separate legibility problem).
- Contrast-aware pill text reuses the `UsMap` luminance approach.

### `ContinentSelector` component (`apps/web/src/components/ContinentSelector.tsx`)

`{ value: WorldView; onChange: (view: WorldView) => void }` — a wrapping row of pill buttons: **World** first, then `CONTINENTS` in order. The active button uses the primary color; the others use the card style. Buttons have `aria-pressed`. Reused as-is by World Compare in Phase 10.

### Counter

Generalize `StateCounter` with an optional `label` prop (default `"states"`) instead of creating a near-duplicate. The World Map page uses `<StateCounter count={n} total={COUNTRIES.length} label="countries" />` → "n/195 countries".

### API client (`apps/web/src/api/countries.ts`)

Mirrors `api/visits.ts`: `getAllCountries(): Promise<PersonCountries[]>` (`{ personId, countryCodes }`), `getVisitedCountries(personId)`, `markCountryVisited(personId, code)`, `unmarkCountryVisited(personId, code)`.

### World section shell

- `App.tsx`: `NAV_ITEMS` gains `{ to: "/world", label: "World", icon: "🌍" }`. The World item is active for **any** path under `/world` (the others keep exact matching).
- Routes: `/world` → `<Navigate to="/world/map" replace />`; `/world/map` → `WorldMapPage`.
- `WorldTabs` component (`apps/web/src/components/WorldTabs.tsx`): the section's sub-tab strip, rendered at the top of each World page. In this phase it contains only **Map**; Phase 10 adds Compare and List.

### `WorldMapPage` (`apps/web/src/pages/WorldMapPage.tsx`)

Mirrors `MapPage`:
- `WorldTabs`, then heading "World Map", error banner, and loading and no-people states matching `MapPage`. The tabs and heading stay visible in the no-people state, so the section's navigation is always reachable.
- Person `<select>` plus a "n/195 countries" counter, in a row that wraps (the longer countries badge overflows a 390px-wide phone otherwise).
- `ContinentSelector`, default **World**. The selected view is kept when switching person.
- In the World view, a muted hint below the selector: "Pick a continent to mark countries."
- `WorldMap` with the selected person's color and `onToggleCountry` → optimistic toggle with rollback (re-fetch) on failure, identical to `MapPage.handleToggleState`.

## Out of scope for this phase

- World Compare and World List pages, and the People-page countries counter — Phase 10.
- Micro-state click targets (Tuvalu, which has no polygon, and the handful of countries that are only a few pixels across) — Phase 11.
- Country labels; free pan/zoom; per-continent completion stats; blended compare coloring; auth.
- Any change to the US pages, the server, or the schema.

## Acceptance criteria

- The nav shows 5 items on desktop and mobile; World is highlighted on every `/world/*` route; `/world` lands on `/world/map`.
- The World view shows the whole world; clicking does nothing; hovering a tracked country shows its name.
- Each of the 6 continents frames that continent fully (Oceania is contiguous across the antimeridian), and its countries toggle on click, persisting across a reload.
- Untracked shapes (Greenland, Taiwan, Kosovo, Antarctica, …) render gray and are inert.
- Switching person keeps the current continent and shows that person's countries in their color; the counter updates on every toggle.
- US pages are unchanged; `npm run build` and the server test suite pass.

## Decisions to carry forward to Phase 10

- `WorldView = Continent | "World"` and the `ContinentSelector` component (controlled, reusable).
- `WorldMap` is read-only when `onToggleCountry` is omitted; Compare passes no handler plus a shared `view`.
- Fixed per-view projections from a `VIEWPORTS` bounding-box table in `WorldMap.tsx`, fitted into a constant 800×500 frame.
- `WorldTabs` is the World section's sub-navigation; new World pages add their tab there and their route in `App.tsx`.
- `StateCounter` takes `label` + `total` for the countries variant.
- `api/countries.ts` exposes `getAllCountries()` for the bulk consumers (World Compare, World List, People page).
