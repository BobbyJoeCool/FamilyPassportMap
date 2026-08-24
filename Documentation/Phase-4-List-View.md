# Phase 4 (v0.4.0) — List View

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phase 1:
- `Person { id, name, colorHex, profilePicturePath?, createdAt }`. Photo storage convention: files under `DATA_DIR/uploads/<filename>`, referenced by `Person.profilePicturePath`, served via a static route (e.g. `GET /uploads/:filename`).

From Phase 3:
- `GET /api/visits` bulk endpoint returning every person's visited states in one call (exact response shape as implemented in Phase 3 — reuse it, don't build a second bulk endpoint).

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states fill in with that color on an interactive US map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all 50 states with icons showing who's visited each one. v1.0.0 covers US states only. There is no login/auth in v1. It's a responsive, installable PWA built with React + TypeScript (Vite) + Tailwind CSS, Node.js + TypeScript (Express), Prisma + SQLite, hosted on Azure App Service's free (F1) tier.

## Goals for this phase

A "list mode" view: all 50 states listed, each showing the profile-picture icon of every person who's visited it — a quick-scan alternative to the map views.

## Detailed requirements

- A List page showing all 50 US states (alphabetical by name, unless a different order is specifically requested later).
- Each state row/card shows: the state name, and a small icon for every person who has visited it.
  - Icon = that person's uploaded profile picture (`profilePicturePath` from Phase 1), rendered small (e.g. an avatar-sized circle).
  - If a person has no uploaded photo, show a fallback avatar (e.g. a circle in their `colorHex` with their initials) instead of a broken image or blank space.
- States nobody has visited are still shown in the list (just with no icons) — this is meant to be a complete 50-state reference, not a "visited only" filtered list.
- Data comes from the same `GET /api/visits` (Phase 3) plus the People list (Phase 1) — no new backend endpoint should be needed for this view; if one turns out to be necessary, treat that as a signal to double check the Phase 3 endpoint's shape rather than immediately adding a new one.

## Out of scope for this phase

- Sorting/filtering options beyond the default order (e.g. "most visited," "by region") — not requested for v1, don't add speculatively.
- Editing visited status from this view — it's view-only, same as Compare view.
- Visual/responsive polish beyond a functional layout (Phase 5).

## Acceptance criteria

- List view shows all 50 states.
- A state visited by two people shows both of their icons (photo or fallback avatar).
- A state visited by no one shows no icons but still appears in the list.
- A person without an uploaded photo shows a sensible fallback avatar, not a broken image.

## Decisions to carry forward to Phase 5

- **Fallback-avatar approach** — `PersonAvatar` component (`apps/web/src/components/PersonAvatar.tsx`), built in Phase 1 and reused here: if the person has a `profilePicturePath`, renders a circular `<img>`; otherwise renders a colored circle (`backgroundColor: colorHex`) with the person's initials in white. Accepts a `size` prop (default 40px). This component is already used on the People page and List page — any future place that shows a person's icon should reuse it rather than building a new avatar.
