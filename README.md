# FamilyPassportMap

FamilyPassportMap is a personal, family-friendly web app for tracking which places you and your family have visited — the 50 US states on a US map, and 195 countries on a world map you explore one continent at a time.

## What it does

- **Interactive US map** — click a state to mark it as visited.
- **Family members** — add people (a name, a chosen color, and an optional profile picture) and track each person's visited states independently.
- **Visited counters** — "n/50 states" and "n/195 countries" badges next to each person (People page, and the matching Map/Compare views).
- **Compare view** — see two or more family members' maps side by side.
- **List view** — see all 50 states in a list, with each visited person's profile-picture icon shown next to the states they've been to.
- **World section** — a separate 🌍 World area for tracking countries (195: the UN member and observer states). Its **World Map** zooms to one continent at a time for marking countries (each country is labeled with its three-letter code, and tiny countries like Vatican City or Tuvalu get a clickable dot), **World Compare** shows people's world maps side by side on a shared continent view, and **World List** groups every country by continent. Country and state tracking are fully independent.
- **Installable PWA** — works and looks right on phone, tablet, and desktop, and can be installed like a native app.

There is no login/account system — it's built as a single-household tool, not a multi-tenant service.

## How to use it

1. Add yourself and any family members you want to track, each with a name, a color, and (optionally) a profile picture.
2. Pick a person and click states on the map to mark them visited — the state fills in with that person's color.
3. Switch to **Compare** view to see two or more people's maps side by side.
4. Switch to **List** view to see every state at a glance, with icons showing who's visited each one.
5. Open **World** to do the same for countries: pick a continent, then click countries to mark them. The World section has its own Map / Compare / List tabs.

## Tech stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, installable as a PWA
- **Backend:** Node.js + TypeScript (Express)
- **Database:** SQLite via Prisma
- **Hosting:** Azure App Service (free tier)

## Project structure & docs

- [`PHASES.md`](PHASES.md) — the phased build plan from initial setup through v1.0.0 (US states) and v2.0.0 (countries/world map), with version numbers per phase
- [`Documentation/`](Documentation/) — one self-contained design spec per phase
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped in each version
- `.claude/CLAUDE.md` — local, gitignored working instructions for Claude Code when developing this repo
- `DevNotes/` — local, gitignored working notes and logs (not part of the shipped app)

## Roadmap

v1.0.0 shipped the US-states feature set; v2.0.0 added countries on a world map (Phases 8–11). Ideas still deliberately deferred — login/multi-household accounts and blended/overlap coloring in Compare — are listed in [`PHASES.md`](PHASES.md).
