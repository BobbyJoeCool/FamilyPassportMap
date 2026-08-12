# Changelog

All notable changes to this project are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Versioning follows the phase plan in [`PHASES.md`](PHASES.md): each build phase ships as `0.x.0`, culminating in `1.0.0` once every phase is built and stabilized.

## [Unreleased]

Nothing in progress right now — see [`PHASES.md`](PHASES.md) for what's next (Phase 2: Interactive Map).

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
