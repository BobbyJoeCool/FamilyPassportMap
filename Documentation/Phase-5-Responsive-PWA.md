# Phase 5 (v0.5.0) — Responsive Design & PWA Packaging

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.

## Carried over from previous phases

From Phases 1–4:
- All core pages exist and function: People management (Phase 1), Map (Phase 2), Compare (Phase 3), List (Phase 4). They are currently unstyled or minimally styled — no responsive design work has been done yet, no PWA support exists.
- Frontend stack: React + TypeScript via Vite, in `apps/web`.

## App overview (full context)

FamilyPassportMap is a web app that lets a user and their family members track which US states they've each visited. Each person gets a chosen color; visited states fill in with that color on an interactive US map. Users can view one person's map at a time, compare multiple people's maps side by side, or see a list of all 50 states with icons showing who's visited each one. v1.0.0 covers US states only. There is no login/auth in v1. Hosting is Azure App Service's free (F1) tier — free-tier constraints don't affect this phase directly, but are why the app is a **responsive, installable PWA** rather than a native Electron desktop app (the original concept): a PWA gets "installed app" behavior on phone, tablet, and desktop without any separate packaging or app-store process.

## Goals for this phase

Make the app genuinely comfortable to use on phone, tablet, and desktop screens, and make it installable as a PWA.

## Detailed requirements

### Responsive design

- Add Tailwind CSS to `apps/web`.
- Restyle all four existing pages (People, Map, Compare, List) with responsive breakpoints instead of a desktop-only fixed layout. Target at minimum: phone (~375–428px wide), tablet (~768–1024px), desktop (1280px+).
- Particular attention needed on:
  - **Map/Compare pages**: the US map SVG must scale down cleanly on narrow screens without becoming unreadable or requiring horizontal scroll of the whole page.
  - **Compare page** with several people selected: decide and implement a reasonable behavior on narrow screens (e.g. stack maps vertically instead of side by side, or allow horizontal scroll within a contained area — pick one, don't leave it undefined).
  - **List page**: state rows/cards should reflow sensibly (e.g. single column on phone, multi-column on desktop).
- Navigation between the four pages needs a pattern that works at every width — e.g. a bottom tab bar or hamburger/drawer menu on phone, a persistent top or side nav on desktop. The exact pattern isn't dictated here; treat it as a decision to make explicitly and record below once chosen, not something to leave ambiguous.

### PWA packaging

- Add `vite-plugin-pwa` (or equivalent) to `apps/web`.
- Configure a web app manifest: app name ("FamilyPassportMap"), icons at the required sizes, theme color, `display: standalone`.
- Configure a service worker for basic offline-shell caching (caches the built app shell/static assets so the app opens even with a flaky connection). This does **not** need to support fully offline API reads/writes — that's out of scope for v1.
- Generate/provide app icons at the sizes the manifest needs.

## Out of scope for this phase

- Full offline data sync (create/edit data while offline and sync later) — not part of v1.
- Native app-store packaging (this is a PWA, not a native iOS/Android/Electron build).
- New features — this phase only restyles and packages what already exists from Phases 1–4.

## Acceptance criteria

- All four pages are comfortably usable — readable, no overlapping/cut-off elements, no unwanted horizontal scroll of the whole page — at phone, tablet, and desktop widths.
- Chrome/Edge's "Install app" prompt appears, and the installed app opens in standalone mode (no browser chrome).
- A Lighthouse PWA audit passes the core installability checks (manifest valid, service worker registered, icons present).

## Decisions to carry forward to Phase 6

- **Navigation pattern chosen for small screens** (record the actual pattern implemented, e.g. "bottom tab bar on <768px, top nav above that") — any page added after v1.0.0 should follow the same pattern rather than introducing a second navigation style.
- **Styling system is Tailwind CSS** — Phase 6 and 7 (and anything post-v1) should extend styling via Tailwind utility classes rather than introducing a second styling approach (CSS modules, styled-components, etc.).
- **Compare page's narrow-screen behavior** (stacked vs. scrollable, whichever was chosen) — relevant if Compare view is ever extended (e.g. a future blended view).
