# Phase 11 (v1.5.0) — World Polish & Hardening

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which places they've each visited. Each person (`Person`: name, color, optional photo) gets a color; visited places fill in with it on a map. It has US-state pages (People, Map, Compare, List). There is no auth; it's a single-household PWA on Azure App Service (F1).

**Phases 8–11 add independent country tracking in a "World" section** (→ v2.0.0). Phase 8: data layer + API. Phase 9: World nav, `WorldMap` with continent zoom, World Map page. Phase 10: World Compare, World List, and country counts on People. **This is the last build phase of the round**, mirroring Phase 7: it closes the known functional gap (tiny countries can't be clicked) and hardens what exists, with no new pages.

## Carried over from previous phases

- **Shared data**: `COUNTRIES` (195 `{ code, numericCode, name, continent }`), `CONTINENTS`, `ISO_NUMERIC_TO_ALPHA2`, `countriesByContinent`.
- **`WorldMap`** (`apps/web/src/components/WorldMap.tsx`):
  - Props: `{ visitedCountryCodes, color, view: WorldView, onToggleCountry? }`, where `WorldView = Continent | "World"`.
  - Renders `world-atlas@2.0.2` `countries-50m.json` in a fixed 800×500 SVG frame. Each view has its own prebuilt `geoEqualEarth` projection, rotated to the view's center longitude and fitted to a lon/lat bounding box (`VIEWPORTS`).
  - Clicks toggle only when `onToggleCountry` is provided **and** `view !== "World"`. Hover shows a name pill in every view. Untracked shapes are inert gray.
- **Pages**: `WorldMapPage` (the only page passing `onToggleCountry`), `WorldComparePage` (read-only cards with a shared continent selector), and `WorldListPage` (grouped by continent). `WorldTabs` sub-nav. The World pages are imported eagerly in `App.tsx`.
- **Topology gap (verified in Phase 8)**: 194/195 countries have a polygon, and only **Tuvalu** has none. Many others are drawn but only a pixel or two across.
- **Bundle (Phase 9)**: a single 1,330 kB JS chunk (423 kB gzip) after adding `world-atlas`; PWA precache 1,344 KiB (Workbox per-file cap is 2 MiB).
- **PWA manifest / root `package.json` description** still say "Track which US states you and your family have visited."

## Decisions made for this phase (with the user, 2026-09-16)

| Decision | Choice |
|---|---|
| Tiny/missing countries | **Clickable markers**: a small dot at the country's capital for every country below a size threshold, plus Tuvalu, shown when the map is zoomed to that country's continent. The dot fills with the person's color when visited. |

## Detailed requirements

### 1. Micro-state markers (`WorldMap.tsx`)

**Which countries.** Countries whose total projected polygon area, in **their own continent's view**, is under **15 square SVG units** (in the 800×500 frame), plus Tuvalu (area 0, no polygon). Measured during this phase by script against the real topology and projections: **29 countries**.

| Continent | Countries |
|---|---|
| Africa | Cabo Verde, Comoros, Mauritius, São Tomé and Príncipe, Seychelles |
| Asia | Bahrain, Maldives, Singapore |
| Europe | Andorra, Liechtenstein, Malta, Monaco, San Marino, Vatican City |
| North America | Antigua and Barbuda, Barbados, Dominica, Grenada, Saint Kitts and Nevis, Saint Lucia, Saint Vincent and the Grenadines |
| Oceania | Kiribati, Marshall Islands, Micronesia, Nauru, Palau, Samoa, Tonga, Tuvalu |

The next-smallest country, Brunei (19.5), is clickable as a polygon. The list is stored as a literal table (`MICRO_STATE_MARKERS`: `code → [lon, lat]` of the capital), not computed at runtime: the topology version is pinned, and a literal table is reviewable. Each marker's continent comes from `COUNTRIES`.

**When shown.** Only when `view` equals the marker country's continent. Not in the World overview (29 dots would clutter it and nothing is clickable there anyway), and not in a neighboring continent's view.

**Appearance.**
- A dot of radius 5 (SVG units): light-gray fill when unvisited, the person's `color` when visited.
- Every dot has the **same** 1-unit medium-gray outline. (A white outline on visited dots was tried first: it made visited dots look smaller than unvisited ones and washed out against the light ocean. The gray ring also keeps a visited dot visible on its own same-colored polygon, e.g. Vatican City on a visited Italy.)
- An invisible radius-8 hit circle around each dot makes the target larger than what's drawn.

**Behavior.** Identical to a polygon of that country: hover shows the name pill, and click calls `onToggleCountry(code)` under the same rule (handler present and a continent view). Read-only maps (World Compare) still show markers, so tiny visited countries are visible there. The underlying tiny polygon is still drawn and still clickable.

**Overlap handling (Lesser Antilles).** In the North America view, seven Caribbean capitals project within ~5–15 units of each other. Like `UsMap`'s small-northeast-state labels, these dots are **offset into a column** in the open Atlantic (x ≈ 760, 15 units apart, north to south: Saint Kitts and Nevis, Antigua and Barbuda, Dominica, Saint Lucia, Saint Vincent and the Grenadines, Barbados, Grenada). A thin connector line runs from each dot to a tiny anchor dot at the true capital. Offsets live in a `MARKER_OFFSETS` table (`code → [dx, dy]`) and are only valid for the current `VIEWPORTS`. If a viewport changes, re-derive them.

### 2. Code-splitting the World section (`App.tsx`)

Load `WorldMapPage`, `WorldComparePage`, and `WorldListPage` with `React.lazy`, inside a `Suspense` whose fallback is the same muted "Loading…" text the pages already use. This keeps `world-atlas` out of the chunk the US pages need. The PWA still precaches every chunk, so World pages keep working offline after first load.

### 3. Copy & metadata

- PWA manifest `description` (`apps/web/vite.config.ts`) and root `package.json` `description`: "Track which US states and countries you and your family have visited."
- `apps/web/index.html` has only a `<title>FamilyPassportMap</title>` (no US-specific text), so it needs no change.

### 4. Verification sweep (local only)

- Every World page at desktop (1280px) and phone (390px) widths, light and dark color schemes.
- On the World Map page:
  - each of the 29 markers appears only in its continent view
  - clicking a marker toggles the country (the counter moves)
  - the Lesser Antilles column shows no overlapping dots
- On World Compare: a visited micro-state shows as a colored dot on a card.
- Server test suite and full workspace build pass.

## Out of scope for this phase

- Country labels; free pan/zoom; per-continent stats; search; blended coloring; auth.
- Marker de-cluttering beyond the Lesser Antilles column. Measured: the closest remaining pair is San Marino–Vatican City at 28 units in the Europe view, wider than two touching hit circles (16), and every marker lands inside the frame.
- Web unit-test infrastructure (the project tests the API only; UI is verified manually/with scripted screenshots, as in Phase 7).

## Acceptance criteria

- All 195 countries can be marked from the World Map page: 166 by polygon alone, and the 29 in the table above via marker (whose polygon, where one exists, is still clickable too).
- Markers follow the same interactivity rules as polygons, including read-only on World Compare and inert in the World overview.
- US pages no longer download the world topology: the production build emits a separate chunk for the World pages. (Result: main chunk 1,330 kB → 556 kB; World chunk 775 kB; PWA precache 1,352 KiB across 19 entries.)
- Descriptions mention countries.
- Build and tests pass; no console errors on any World page.

## Decisions to carry forward to v2.0.0

- `MICRO_STATE_MARKERS` (29 capitals) and `MARKER_OFFSETS` (7 Lesser Antilles dots, valid only for the current North America viewport) are part of `WorldMap`'s fixed data, alongside `VIEWPORTS`.
- World pages are lazy-loaded route chunks.
- v2.0.0 is a stabilization pass only: walk every page end to end and sync `README.md`, `PHASES.md`, the spec docs, and the plan doc's status. Fix the stale `CLAUDE.md` link in the README (the file now lives in `.claude/`), then bump to 2.0.0.
