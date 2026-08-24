# Phase 7 (v0.7.0) — Polish, Validation & Hardening

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phases 1–6:
- A fully feature-complete, deployed app: People management (create/edit/delete with photo, Phase 1), Map (Phase 2), Compare (Phase 3), List (Phase 4), responsive + installable PWA (Phase 5), live on Azure free tier via CI/CD (Phase 6).
- Data model: `Person` and `VisitedState` (Prisma/SQLite), cascade-delete on `Person` removal.
- Photo storage under `DATA_DIR/uploads/`.

This is the last phase before v1.0.0 — its job is to make everything built so far solid, not to add anything new.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states fill in with that color on an interactive US map, with Compare (side-by-side) and List views also available. v1.0.0 covers US states only. There is no login/auth in v1 — the app is fully open to anyone with the URL. Tech stack: React + TypeScript (Vite) + Tailwind CSS frontend, Node.js + TypeScript (Express) backend, Prisma + SQLite database, hosted on Azure App Service's free (F1) tier.

## Goals for this phase

Close the gap between "works" and "solid": validation, error states, empty states, and edge cases across everything built in Phases 1–6. No new features.

## Detailed requirements

### Validation

- Person form (Phase 1): name required and non-empty; `colorHex` must be a valid hex color; photo upload restricted to allowed image types and a defined size limit. Validate both client-side (immediate feedback) and server-side (source of truth — never trust the client alone).
- Clear, specific inline error messages for each validation failure (not a generic "something went wrong").

### Empty states

- **No people exist yet**: Map, Compare, and List pages should show a clear prompt to add a person first (e.g. a message + link to the People page), not a blank or broken-looking screen.
- **A person with zero visited states**: their map/compare entry should render normally (fully unfilled map), not error.

### Destructive-action confirmation

- Deleting a person (Phase 1's delete action) requires a confirmation step (e.g. a confirm dialog stating their visited-state history will also be removed, per the cascade-delete behavior from Phase 1) before it executes.

### Loading & error states

- Every API call from the frontend (people CRUD, visits, bulk visits, photo upload) has a visible loading state while in flight and a visible, user-facing error state if it fails (network error, server error) — no silent failures where the UI just looks frozen or reverts with no explanation.

### Test coverage

- At minimum, automated tests for the API routes: people CRUD (Phase 1) and visits CRUD (Phase 2), covering both success and validation-failure cases.
- Frontend test coverage beyond that is a judgment call based on time available at this point in the project — not mandated in detail here.

## Out of scope for this phase

- Any new feature, page, or API endpoint — this phase only hardens what Phases 1–6 already built.

## Acceptance criteria

- No console errors during normal use across all four pages.
- Deleting a person requires confirmation and correctly removes their `VisitedState` rows.
- The app doesn't break with zero people or zero visited states — verified by testing both states directly (e.g. against a freshly seeded/empty database).
- A simulated API failure (e.g. stop the server mid-interaction, or mock a failed request) shows a user-facing error message instead of a blank or frozen screen.
- API test suite passes for people and visits CRUD, including invalid-input cases.

## Decisions to carry forward to v1.0.0

- **Validation rules finalized**: Name required (non-empty after trim), colorHex must match `/^#[0-9A-Fa-f]{6}$/`, photo types JPEG/PNG/WebP only, 5 MB max. These are the permanent contract.
- **Test framework**: Vitest + Supertest for server API tests. Tests run against an isolated temporary SQLite database (migration applied via `prisma migrate deploy`). Run with `npm test`.
- **Express app refactored**: App setup lives in `apps/server/src/app.ts`; `index.ts` just starts the listener. This split is load-bearing for tests.
- **v1.0.0 itself is not a new design phase** — it's a stabilization/regression pass confirming Phase 7's acceptance criteria hold up end-to-end, followed by a final sync of `README.md`, `PHASES.md`, and `CHANGELOG.md` to match what actually shipped, and the version bump to `1.0.0`.
