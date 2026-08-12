# FamilyPassportMap

FamilyPassportMap is a personal, family-friendly web app for tracking which places you and your family have visited — starting with the 50 US states, with countries and a world map planned for a future version.

## What it does

- **Interactive US map** — click a state to mark it as visited.
- **Family members** — add people (a name, a chosen color, and an optional profile picture) and track each person's visited states independently.
- **Compare view** — see two or more family members' maps side by side.
- **List view** — see all 50 states in a list, with each visited person's profile-picture icon shown next to the states they've been to.
- **Installable PWA** — works and looks right on phone, tablet, and desktop, and can be installed like a native app.

There is no login/account system in v1 — it's built as a single-household tool, not a multi-tenant service.

## How to use it

1. Add yourself and any family members you want to track, each with a name, a color, and (optionally) a profile picture.
2. Pick a person and click states on the map to mark them visited — the state fills in with that person's color.
3. Switch to **Compare** view to see two or more people's maps side by side.
4. Switch to **List** view to see every state at a glance, with icons showing who's visited each one.

## Tech stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, installable as a PWA
- **Backend:** Node.js + TypeScript (Express)
- **Database:** SQLite via Prisma
- **Hosting:** Azure App Service (free tier)

## Project structure & docs

- [`PHASES.md`](PHASES.md) — the phased build plan from initial setup through v1.0.0, with version numbers per phase
- [`Documentation/`](Documentation/) — one self-contained design spec per phase
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped in each version
- [`CLAUDE.md`](CLAUDE.md) — working instructions for Claude Code when developing this repo
- `DevNotes/` — local, gitignored working notes and logs (not part of the shipped app)

## Roadmap

v1.0.0 covers the US-states feature set described above. Future versions plan to extend the same map/list/compare experience to countries and a world map — see [`PHASES.md`](PHASES.md) for where that fits relative to the current build.
