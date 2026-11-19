# Phase 1 (v0.1.0) — Data Layer & People Management

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phase 0:
- Monorepo layout is fixed: `apps/server` (Express + TS), `apps/web` (React + TS/Vite), `packages/shared` (shared TS types).
- Prisma is already initialized in `apps/server` with the SQLite provider, using a `DATA_DIR` env var to locate the database file (`./data` locally; a persistent Azure path in production, set up in Phase 6). No models exist yet.
- Express skeleton exists with `GET /api/health`. Vite React skeleton exists with only a starter page.
- Node 24 (current Active LTS), npm workspaces, ESLint/Prettier already configured.
- **Prisma 7 requires an explicit driver adapter to connect** — this was discovered during the actual Phase 0 build, after this doc was originally written, so it's called out here rather than being assumed. `apps/server` already has `@prisma/adapter-better-sqlite3` and `better-sqlite3` installed. Any `PrismaClient` instantiation (e.g. in a `src/db.ts` singleton this phase creates) must look like:
  ```ts
  import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
  import { PrismaClient } from "@prisma/client";

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
  export const prisma = new PrismaClient({ adapter });
  ```
  Plain `new PrismaClient()` with no adapter throws `PrismaClientInitializationError` at runtime — don't reintroduce that pattern.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states are filled in with that color on an interactive US map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all 50 states with icons showing who's visited each one. v1.0.0 covers US states only (no countries/world map yet). There is no login/auth in v1 — it's a single-household, unauthenticated tool. It's a responsive, installable PWA built with React + TypeScript (Vite) + Tailwind CSS on the frontend, Node.js + TypeScript (Express) on the backend, Prisma + SQLite for data, hosted on Azure App Service's free (F1) tier.

**Important modeling point:** there is no separate "user account" vs. "family member" distinction. The person using the app is just the first `Person` record they create for themselves — everyone tracked in the app, including the account owner, is the same kind of entity. There's no auth, so there's no concept of "who is logged in" to distinguish.

## Goals for this phase

Define the core data model and build full CRUD for people, including profile picture upload, exposed through the API and a basic (unstyled — visual polish is Phase 5) management UI.

## Detailed requirements

### Data model (Prisma schema, `apps/server/prisma/schema.prisma`)

Two models — define both now even though visited-state editing UI doesn't ship until Phase 2, since `VisitedState` references `Person`:

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
  stateCode String   // 2-letter USPS code, e.g. "CA"
  visitedAt DateTime @default(now())

  @@unique([personId, stateCode])
}
```

Deleting a `Person` should cascade-delete their `VisitedState` rows (`onDelete: Cascade`), so removing someone cleans up their visit history automatically.

Create and apply the initial migration.

### API routes (`apps/server`)

- `GET /api/people` — list all people.
- `POST /api/people` — create a person. Body: `{ name: string, colorHex: string }`. Validate `colorHex` is a valid hex color and `name` is non-empty.
- `PATCH /api/people/:id` — update name and/or color.
- `DELETE /api/people/:id` — delete a person (cascades their visited states).
- `POST /api/people/:id/photo` — multipart upload of a profile picture. Store the file under `DATA_DIR/uploads/`, save the resulting relative path on `Person.profilePicturePath`. Accepted formats: JPEG, PNG, WebP. Max size: 5MB. Reject anything else with a clear validation error.
- Serve uploaded files statically (e.g. `GET /uploads/:filename`) so the frontend can render them.

### Shared types (`packages/shared`)

Define the `Person` shape (and zod — or equivalent — validation schemas for the create/update payloads) once in `packages/shared`, imported by both `apps/server` (request validation) and `apps/web` (typed API client). Don't duplicate the type definition in both apps.

### Frontend — People page (`apps/web`)

A basic page (no specific route/URL structure mandated — pick something sensible, e.g. `/people`) that:
- Lists existing people (name, color swatch, photo thumbnail or fallback).
- Has a form to add a new person: name field, a color picker (any reasonable hex color picker component — no fixed palette required) — **required**, the form cannot be submitted without a color chosen — and an optional photo upload.
- Allows editing an existing person's name/color/photo.
- Allows deleting a person (a confirmation prompt before deleting is Phase 7's job — a plain delete action is fine here).

## Out of scope for this phase

- Map UI and visited-state toggling UI — the `VisitedState` schema and any future API for it beyond what's listed above are Phase 2's job.
- Compare view, List view.
- Styling/responsiveness polish (Phase 5) — functional, unstyled UI is fine.
- Deployment (Phase 6).
- Delete confirmation dialogs, form validation error polish (Phase 7).

## Acceptance criteria

- Can create, edit, and delete a person (including a photo) through the UI.
- Data persists across a server restart (confirms SQLite durability under the `DATA_DIR` convention from Phase 0).
- `GET /api/people` reflects all changes made through the UI.
- Deleting a person removes their `VisitedState` rows too (verify via a direct DB check, since there's no visited-state UI yet to confirm visually).

## Decisions to carry forward to Phase 2

- **Final `Person` and `VisitedState` schema** as implemented (field names/types may be refined during building — record the actual final shape here if it changes from the draft above).
- **Photo storage convention**: files under `DATA_DIR/uploads/<filename>`, referenced by `Person.profilePicturePath`, served via a static route. Phase 4 (List view icons) and Phase 6 (Azure persistent storage) both depend on this being correct.
- **Shared type/validation pattern** in `packages/shared` — later phases should add to this file rather than duplicating types in `apps/server`/`apps/web`.
- **State code convention**: `VisitedState.stateCode` uses 2-letter USPS codes (e.g. "CA", "NY") — Phase 2 onward must use the same convention everywhere states are referenced, including in the map library's data.
