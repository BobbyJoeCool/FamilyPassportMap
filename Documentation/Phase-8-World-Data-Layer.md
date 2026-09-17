# Phase 8 (v1.2.0) — World Data Layer & Countries API

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which places they've each visited. Each person gets a chosen color; visited places are filled in with that color on an interactive map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all places with icons showing who's visited each one.

v1.0.0 shipped **US states only**: a `Person` model, a `VisitedState` model, an Express + Prisma/SQLite API, and a React (Vite + Tailwind) PWA with four pages — People, Map, Compare, List. There is no login/auth — it's a single-household, unauthenticated tool, hosted on Azure App Service's free (F1) tier.

**Phases 8–11 add a second, parallel tracking system: countries visited, on a world map**, navigated by zooming into one continent at a time. It mirrors the existing US experience as its own independent "World" section. The full design rationale lives in `DevNotes/Plans/v2.0-World-Map-Countries.md` (approved by the user 2026-09-16); this doc is the spec for the first of its four phases.

**Important modeling point:** there is no separate "user account" vs. "family member" distinction. Everyone tracked in the app, including the person using it, is the same kind of `Person` entity.

## Carried over from previous phases

From Phases 1–7 (all complete, shipped as v1.0.0):

- **Monorepo layout**: `apps/server` (Express 5 + TypeScript), `apps/web` (React 19 + TypeScript/Vite), `packages/shared` (shared TS types, imported by both as `@familypassportmap/shared`). npm workspaces, Node 20+.
- **Prisma 7 + SQLite.** Two models exist, `Person` and `VisitedState` (schema reproduced below). The datasource URL is **not** in `schema.prisma` — Prisma 7 reads it from `apps/server/prisma.config.ts`, which loads `DATABASE_URL` from `.env`. Connecting also requires an explicit driver adapter:
  ```ts
  import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
  import { PrismaClient } from "@prisma/client";

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
  export const prisma = new PrismaClient({ adapter });
  ```
  Plain `new PrismaClient()` throws at runtime — don't reintroduce that pattern.
- **Existing schema:**
  ```prisma
  model Person {
    id                 String         @id @default(cuid())
    name               String
    colorHex           String
    profilePicturePath String?
    createdAt          DateTime       @default(now())
    visitedStates      VisitedState[]
  }

  model VisitedState {
    id        String   @id @default(cuid())
    personId  String
    person    Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
    stateCode String // 2-letter USPS code, e.g. "CA"
    visitedAt DateTime @default(now())

    @@unique([personId, stateCode])
  }
  ```
- **Existing visits API** — the exact pattern this phase mirrors for countries:
  - `GET /api/people/:id/visits` → `string[]` of that person's state codes; 404 if the person doesn't exist (an existing person with no visits gets `[]`, not a 404).
  - `PUT /api/people/:id/visits/:stateCode` → 204, idempotent upsert; uppercases the code; 400 for an unknown code; 404 for an unknown person (detected via Prisma error `P2003`, a foreign-key violation).
  - `DELETE /api/people/:id/visits/:stateCode` → 204, idempotent; 404 for an unknown person.
  - `GET /api/visits` → `{ personId, stateCodes }[]`, every person in one call, used by Compare and List so they don't fan out one request per person.
  - Routers live in `apps/server/src/routes/visits.ts` as two exports (`visitsRouter`, `bulkVisitsRouter`), mounted in `apps/server/src/app.ts`.
- **Shared data convention**: `packages/shared/src/usStates.ts` exports `US_STATES` (code + name), `US_STATE_CODES`, and `FIPS_TO_USPS` — a bridging table from the TopoJSON map data's numeric ids to the codes the database stores. Everything is re-exported from `packages/shared/src/index.ts`. Country data follows the same shape.
- **Testing**: Vitest + Supertest against the real Express app (`apps/server/src/app.ts` is exported separately from the listener so tests can import it). `apps/server/tests/setup.ts` creates a temp SQLite DB, runs `prisma migrate deploy`, and truncates every table in a `beforeEach`. 23 tests currently pass.
- **Code documentation standard** (from `CLAUDE.md`): every function gets a JSDoc comment; conditionals and loops get a short explanatory comment; variable definitions don't.

## Goals for this phase

Build the entire **data layer** for country tracking — schema, canonical country reference data, and API — with **no UI**. At the end of this phase, countries can be marked and unmarked via HTTP and persist correctly; nothing is visible in the browser yet.

## Detailed requirements

### Data model (`apps/server/prisma/schema.prisma`)

One new model, **purely additive**. No changes to `Person` beyond adding the back-relation, and no changes at all to `VisitedState`:

```prisma
model VisitedCountry {
  id          String   @id @default(cuid())
  personId    String
  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)
  countryCode String // ISO 3166-1 alpha-2 code, e.g. "FR"
  visitedAt   DateTime @default(now())

  @@unique([personId, countryCode])
}
```

`Person` gains `visitedCountries VisitedCountry[]`.

This is a deliberate structural copy of `VisitedState` rather than a generalized "visited place" table. **Country tracking and state tracking are fully independent**: marking the US as a visited country does not check any states, and checking every state does not mark the US visited. No derivation in either direction, ever.

Create and apply a migration for it. Update `Documentation/diagrams/ERD.mmd` in the same change (per `CLAUDE.md`'s Diagram Sync Requirements) — it gains a `PERSON ||--o{ VISITED_COUNTRY` relationship alongside the existing one.

### Country reference data (`packages/shared/src/countries.ts`)

A new file, structured like `usStates.ts` and re-exported from `index.ts`.

**Scope: exactly 195 countries** — the 193 UN member states plus the 2 UN observer states (Vatican City and Palestine). No dependent territories, no partially-recognized states (so no Kosovo, Taiwan, Western Sahara, Northern Cyprus, Somaliland — all of which *do* appear in the map data and must simply render as unmarkable background).

**Continent taxonomy: 6 inhabited continents** — Africa, Asia, Europe, North America, Oceania, South America. No Antarctica. Every country gets exactly **one** continent; no country is dual-listed. North America includes Central America and the Caribbean.

Exports:

```ts
export type Continent = "Africa" | "Asia" | "Europe" | "North America" | "Oceania" | "South America";
export const CONTINENTS: Continent[];              // the 6 above, alphabetical

export interface Country {
  code: string;         // ISO 3166-1 alpha-2, e.g. "FR"
  numericCode: string;  // ISO 3166-1 numeric, zero-padded to 3 chars, e.g. "250"
  name: string;         // common English name
  continent: Continent;
}

export const COUNTRIES: Country[];                 // 195 entries, alphabetical by name
export const COUNTRY_CODES: string[];              // COUNTRIES.map(c => c.code)
export const ISO_NUMERIC_TO_ALPHA2: Record<string, string>;
export function countriesByContinent(continent: Continent): Country[];
```

`ISO_NUMERIC_TO_ALPHA2` is **derived** from `COUNTRIES` (via each entry's `numericCode`) rather than hand-maintained as a second literal table. This differs from the shape sketched in the plan doc, which proposed a standalone literal map; deriving it removes any chance of the two lists drifting apart. Its purpose is the same one `FIPS_TO_USPS` serves for states: the world map's TopoJSON identifies each country by **ISO 3166-1 numeric** code, while the database stores alpha-2, so Phase 9 needs this bridge.

Because `COUNTRIES` is authored alphabetically by name, `countriesByContinent` preserves that ordering — which is exactly what the Phase 10 World List (grouped by continent, alphabetical within each group) needs, with no re-sorting.

#### Transcontinental / ambiguous assignments (fixed, deliberate)

ISO 3166 does not assign continents — any such mapping is a convention, so these are human calls, made once and documented here so they don't get silently "corrected" later:

| Country | Assigned continent | Rationale |
|---|---|---|
| Russia | Europe | Population, capital, and the common convention in travel-tracking apps |
| Turkey | Asia | |
| Kazakhstan | Asia | |
| Azerbaijan | Asia | |
| Georgia | Asia | |
| Armenia | Asia | |
| Cyprus | Europe | Geographically Asian; politically/culturally grouped with Europe (EU member) |
| Egypt | Africa | The Sinai is in Asia, but Egypt as a whole is conventionally African |
| Timor-Leste | Asia | Grouped with Southeast Asia rather than Oceania |
| Trinidad and Tobago | North America | Caribbean → North America, consistent with the rest of the Caribbean |

Resulting per-continent totals: Africa 54, Asia 47, Europe 45, North America 23, Oceania 14, South America 12 = **195**.

### API (`apps/server/src/routes/countries.ts`)

A new file exporting two routers, mirroring `visits.ts` exactly — same status codes, same idempotency, same 404 semantics:

- `GET /api/people/:id/countries` — that person's visited country codes as `string[]`; 404 if the person doesn't exist.
- `PUT /api/people/:id/countries/:countryCode` — mark visited. Idempotent upsert → 204. Uppercases the code. 400 (`{ error: "Unknown country code" }`) if the code isn't in `COUNTRY_CODES`. 404 if the person doesn't exist.
- `DELETE /api/people/:id/countries/:countryCode` — unmark. Idempotent → 204. 404 if the person doesn't exist. Unmarking a country that was never marked is a successful no-op, not a 404.
- `GET /api/countries` — every person's visited countries in one call: `{ personId, countryCodes }[]`. This is the endpoint the Phase 10 World Compare and World List views consume, exactly as they consume `GET /api/visits` today.

Mounted in `apps/server/src/app.ts` alongside the existing routes:

```ts
app.use("/api/people/:id/countries", countriesRouter);
app.use("/api/countries", bulkCountriesRouter);
```

Note the naming asymmetry with the US side (`/api/people/:id/visits` + `/api/visits`): the country routes use `/countries` in both positions. `/api/countries` returns **visited** countries per person — it is not a reference-data endpoint for the country list itself, which ships in `packages/shared` and needs no HTTP round trip.

### Tests (`apps/server/tests/countries.test.ts`)

Mirror `visits.test.ts` case for case: empty-initially, mark, idempotent re-mark, lowercase normalization, invalid code → 400, unknown person → 404 on all three verbs, unmark, idempotent unmark, and the bulk endpoint grouping multiple people. Add at least one test that proves **independence from states** — marking `US` as a visited country leaves `GET /api/people/:id/visits` empty, and vice versa — plus one confirming cascade delete removes a person's `VisitedCountry` rows.

`apps/server/tests/setup.ts` must also truncate `visitedCountry` in its `beforeEach`, or tests will leak rows into each other.

## Out of scope for this phase

- **All UI.** No `WorldMap` component, no World pages, no nav changes, no map library dependency (`world-atlas`) — that's Phase 9.
- Continent viewports / zoom behavior — Phase 9.
- World Compare and World List views — Phase 10.
- The micro-state marker fallback for countries whose polygons are too small to click — Phase 11.
- Any change to existing US-states behavior, the People page, or the `Person` color/photo model.
- Login/auth, blended compare coloring — still out of scope project-wide.

## Acceptance criteria

- `npx prisma migrate deploy` applies cleanly on a fresh database, and the existing `Person`/`VisitedState` data in a pre-existing database survives the migration untouched.
- `COUNTRIES` has exactly 195 entries with no duplicate `code` and no duplicate `numericCode`, and every `continent` value is one of the 6.
- Every country's `numericCode` that corresponds to a polygon in the world map data resolves to the right country — verified against the actual `world-atlas` topology, not authored from memory alone.
- All four endpoints behave as specified, including the 400/404/idempotency cases.
- The full server test suite passes (the pre-existing 23 tests plus the new country tests).
- Marking countries has zero effect on visited states, and vice versa.
- `Documentation/diagrams/ERD.mmd` matches the post-migration schema exactly.

## Decisions to carry forward to Phase 9

- **Final `VisitedCountry` schema** as implemented, and the fact that state and country tracking share nothing but `Person`.
- **`Country` shape including `numericCode`**, and that `ISO_NUMERIC_TO_ALPHA2` is derived from it. Phase 9's `WorldMap` looks up `ISO_NUMERIC_TO_ALPHA2[geo.id]`; any topology id with no entry is a non-tracked territory (Kosovo, Taiwan, Greenland, Puerto Rico, …) and must render as inert background rather than throwing or being clickable.
- **Polygon coverage in `world-atlas@2.0.2`'s `countries-50m.json`** (verified by script against the actual topology during this phase): **194 of 195 countries have a polygon. Only Tuvalu (`TV`, `798`) has none.** This is a much smaller gap than the original plan feared — Vatican City, Monaco, San Marino, Liechtenstein, Nauru, Palau, and the other micro-states all *do* have polygons at 50m, though many are only a few pixels across at continent zoom. So Phase 11's fallback problem is really two problems: one country that can't render at all (Tuvalu), and a handful that render but may be too small to click reliably.
- **Topology quirks Phase 9 must tolerate**: 241 geometries total; 42 of them are untracked background (dependent territories, Antarctica, and non-UN states like Taiwan and Kosovo). Five geometries have **no `id` at all** (Kosovo, Northern Cyprus, Somaliland, Indian Ocean Territories, Siachen Glacier), and one id is **shared by two geometries** (`036` = both Australia and Ashmore and Cartier Islands — both correctly resolve to `AU`). Geography keys in React must not rely on `id` alone being present or unique.
- **Country code convention**: uppercase ISO 3166-1 alpha-2 everywhere — database, API paths, shared data, and (in Phase 9) map component props.
- **Continent assignments are fixed data, not derived** — the table above is the source of truth, and `countriesByContinent` is the only way UI code should partition the list.
