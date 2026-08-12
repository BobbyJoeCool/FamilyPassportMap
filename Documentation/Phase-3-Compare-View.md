# Phase 3 (v0.3.0) — Compare View (Side-by-Side)

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phase 1:
- `Person` / `VisitedState` schema, People CRUD API, `stateCode` = 2-letter USPS codes.

From Phase 2:
- `GET/PUT/DELETE /api/people/:id/visits[...]` API exists.
- `UsMap` is a shared, reusable React component (built with `react-simple-maps` + a US states TopoJSON source) that renders a colored US map for a given person's visited states. It currently supports click-to-toggle for the Phase 2 Map page.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states fill in with that color on an interactive US map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all 50 states with icons showing who's visited each one. v1.0.0 covers US states only. There is no login/auth in v1. It's a responsive, installable PWA built with React + TypeScript (Vite) + Tailwind CSS, Node.js + TypeScript (Express), Prisma + SQLite, hosted on Azure App Service's free (F1) tier.

**Explicit decision from initial design discussion:** Compare view renders **separate maps side by side**, one per selected person — it does **not** blend colors for states multiple people have visited. A blended/combined view was considered and deliberately deferred as a possible post-v1 enhancement, not built now.

## Goals for this phase

Let the user select multiple people and see their individual maps rendered next to each other for easy visual comparison.

## Detailed requirements

### API — bulk visits endpoint

Add `GET /api/visits` returning every person's visited states in a single response (e.g. an array of `{ personId, stateCode }` or grouped by person — pick whichever shape is more convenient for the frontend, document the actual choice here once built). This avoids firing one `/api/people/:id/visits` request per selected person when rendering several maps at once.

### Frontend — Compare page

- A multi-select control (checkboxes, chips, or similar) listing all people from the Phase 1 People API.
- For each selected person, render one instance of the `UsMap` component (from Phase 2) in **read-only** mode — clicking a state here does not toggle it; editing visited status still only happens on the Phase 2 Map page. If `UsMap` doesn't already support a read-only mode, add one (a prop like `readOnly`) rather than forking the component.
- Selected people's maps lay out side by side (exact responsive behavior for many people at once — wrapping, scrolling, etc. — is refined in Phase 5; a simple flex/grid layout that works reasonably for 2–4 people is enough here).
- Each map is colored using that person's own `colorHex`, same as the Phase 2 Map page.

## Out of scope for this phase

- Blended/overlap coloring (explicitly deferred, see above).
- Editing visited states from this view.
- Final responsive layout polish for large numbers of people (Phase 5).
- List view (Phase 4).

## Acceptance criteria

- Selecting 2 or more people renders that many read-only maps side by side, each accurately showing that person's visited states (sourced from the same underlying data as the Phase 2 Map page — verify by toggling a state on the Map page and confirming it shows up here too).
- Deselecting a person removes their map from the view.
- `UsMap`'s read-only mode does not allow toggling states from this page.

## Decisions to carry forward to Phase 4

- **`GET /api/visits` bulk endpoint shape** — record its actual response shape here once implemented. Phase 4's List view reuses this same endpoint rather than defining a new bulk-fetch API.
- **`UsMap` now supports a read-only mode** — any future view that displays but doesn't edit visited states (including List view's per-state icons, if it ever needs map context) should use this same flag rather than duplicating logic.
