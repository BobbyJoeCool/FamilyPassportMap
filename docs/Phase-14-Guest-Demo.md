# Phase 14 (v2.4.0) — Guest Demo on GitHub Pages

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.
>
> **Where the tickets live:** per ADR 0001, this spec stays here and its implementation tickets are GitHub issues linked from this doc and from the `PHASES.md` row. Tickets are cut once Bob approves this spec.

**Status:** Built 2026-11-19 on branch `phase-14-guest-demo`, pending Bob's manual checklist and the first Pages publish. Both open questions are answered (see the end). Where the build differs from the first draft, this doc was updated to match, and the changes are listed under "Changes made while building".

## Tickets

- [#20 Phase 14 — Guest Demo on GitHub Pages](https://github.com/BobbyJoeCool/FamilyPassportMap/issues/20) (parent)
- [#21 Phase 14.1 — In-browser fake API and sample family](https://github.com/BobbyJoeCool/FamilyPassportMap/issues/21)
- [#22 Phase 14.2 — API contract tests (real server vs fake API)](https://github.com/BobbyJoeCool/FamilyPassportMap/issues/22)
- [#23 Phase 14.3 — Demo build and web app changes](https://github.com/BobbyJoeCool/FamilyPassportMap/issues/23)
- [#24 Phase 14.4 — Demo E2E tests](https://github.com/BobbyJoeCool/FamilyPassportMap/issues/24)
- [#25 Phase 14.5 — GitHub Pages workflow, README link and release docs](https://github.com/BobbyJoeCool/FamilyPassportMap/issues/25)

## App overview (full context)

FamilyPassportMap is a web app for tracking which places each member of a family has visited. Each Person has a name, a required color and an optional profile photo. Visited places fill in with that color on maps. Three sections share sub-tabs: **People**; **US** (Map, Compare, List for the 50 states); **World** (Map, Compare, List for 195 countries, zoomed one continent at a time).

**Stack:** React, TypeScript, Vite and Tailwind on the front end (an installable PWA). Node, Express, Prisma 7 and SQLite on the back end. npm workspaces: `apps/server`, `apps/web`, `packages/shared`.

**The real app** needs a sign-in (Phase 12, widened to five sign-in methods in Phase 13) and runs on Bob's home server at `https://passport.bobbyjoecool.dev`. Every User sees only their own People, up to 10.

**The repo is a portfolio piece.** Potential employers reading the README can't sign in to a private family app, so today they can only look at screenshots.

## Carried over from previous phases

- **All web API calls go through `fetch` with absolute `/api/...` paths**, in `apps/web/src/api/` (`people.ts`, `visits.ts`, `countries.ts`, `auth.ts`), and every response goes through `handleResponse` in `http.ts`. A `401` sends the browser to `/signin`.
- **Photos** are served from `/uploads/<file>` and shrunk to 256×256 by the server.
- **The app's routes** use `BrowserRouter` at the site root. The service worker caches only the app shell and never answers `/api/*` or `/uploads/*`.
- **Rules the server enforces** that the demo must copy: name required; color required (hex); up to 10 People including the Primary Person; the Primary Person can't be deleted; **Set as me** merges visits into the chosen Person and removes the old Primary Person; visits are unique per Person and place.
- **Shared types and reference data** (states, countries, continents, the `Person` shape) live in `packages/shared`.

## Domain language

New term (added to `CONTEXT.md`):

**Guest demo**: a separate copy of the web app, hosted on GitHub Pages, that runs entirely in the browser with a made-up family. Nothing is saved, and a reload starts it over.
_Avoid_: Demo account, sandbox, trial (there's no account and nothing to upgrade)

## Problem Statement

Anyone who wants to try FamilyPassportMap has to have an account on Bob's server. Bob doesn't want strangers creating accounts on his home server, and a shared public login (FitIQ's approach) would let one visitor's changes show up for the next.

## Solution

Build the same web app a second way, with a `demo` build flag. In the demo build, a small fake API inside the browser answers every `/api` and `/uploads` request from an in-memory copy of a made-up family. It opens straight into that family with no sign-in, shows a banner saying it's a demo that resets on reload, and is published to GitHub Pages on every push to `main`. The real server is never involved.

## User Stories

1. As a visitor, I open the demo link from the README and land on the US map with a family already filled in, without signing in.
2. As a visitor, I can do everything a real User can: add, edit, recolor and delete People, upload a photo, use **Set as me**, mark states and countries, and use Map, Compare and List in both sections.
3. As a visitor, I hit the same limits a real User would (10 People, can't delete "You"), so the demo is honest about how the app works.
4. As a visitor, a banner tells me this is a demo, nothing is saved, and reloading resets it.
5. As a visitor, I don't see sign-in, sign-out, the Sign-in methods page or Delete account, since they'd do nothing.
6. As a visitor on a phone, the demo works and looks the same as the real app.
7. As Bob, the demo updates itself every time `main` changes, so it never drifts from the real app.

## Implementation Decisions

### Build flag

- `VITE_DEMO=true` at build time makes a demo build. `npm run build:demo` (root or `apps/web`) runs `vite build --mode demo`, which sets it, and produces the demo in `apps/web/dist-demo/`. The normal build is unchanged and contains none of the demo code (it's loaded only behind the flag, so Vite drops it). The normal web build now ends with `apps/web/scripts/check-no-demo-code.mjs`, which fails the build if a marker string from `src/demo/` turns up in `dist/`.
- The demo's base path comes from the `DEMO_BASE_PATH` environment variable at build time (default `/`).

### The in-browser fake API

- **One seam:** in a demo build, `main.tsx` installs a replacement `fetch` before the app renders. Requests whose path starts with `/api/` or `/uploads/` go to the fake API; everything else goes to the real `fetch`. The `apps/web/src/api/` modules and every page stay unchanged.
- **Lives in** `apps/web/src/demo/`: `fakeApi.ts` (routing and handlers), `seed.ts` (the sample family), `store.ts` (in-memory state), `photo.ts` (canvas shrinking) and `install.ts` (puts the fake API in front of `fetch` and sets the photo URLs).
- **Photo URLs:** an `<img>` request doesn't go through `fetch`, so the replacement `fetch` alone can't show photos. `PersonAvatar` gets its `src` from `photoUrl()` in `apps/web/src/api/photos.ts`. The normal app returns `/uploads/<file>` as before; the demo swaps in a resolver that returns a `blob:` URL for each in-memory photo. This is the one change to `apps/web/src/api/`.
- **State is in memory only.** No `localStorage`, `sessionStorage` or IndexedDB, so a reload always starts from the seed.
- **Routes it answers** (same paths, status codes, bodies and error messages as the real server):
  - `GET /api/me` → a Guest User (`displayName` "Guest", empty email) with a Primary Person (so the welcome step never shows). `POST /api/me/primary-person` answers like the server does once welcome is done (`409`), and `GET /api/health` answers `{ status: "ok" }`.
  - People: list, create, rename/recolor, delete, photo upload, claim, allowance.
  - State and country visits: per Person get/put/delete, and the bulk maps.
  - `GET /uploads/<file>` → the photo's bytes.
  - Anything else under `/api/` → `404 { error: "Not available in the demo." }`.
- **Rules:** the same validation and limits as the server (see Carried over). The shared validation in `packages/shared` is reused wherever it exists; where the server has rules only in its own code, the demo copies them and a contract test (below) keeps them matched.
- **Photos:** an uploaded file is center-cropped and resized to 256×256 in the browser with a canvas, held as a `Blob`, and served back at a made-up `/uploads/demo-<id>.<ext>` path. Same size and format limits as the server (JPEG, PNG, WebP, 5 MB).
- **Small delay:** each fake response waits 150 ms so loading states are visible, as they would be on the real app.

### Sample family

- Bob chose the Simpsons' names: **Homer** ("You", 20 states and 8 countries), **Marge** (12 and 5), **Bart** (8 and 3) and **Lisa** (10 and 6), each with a distinct color. Their visits overlap so Compare is interesting, and between them every continent has a visit.
- Names only, no pictures of the characters. Marge and Lisa get an original "passport stamp" monogram avatar (an SVG generated in `seed.ts`); Homer and Bart show the app's usual initials, so both kinds of avatar appear.
- Names and visits live in `seed.ts`.

### Web app changes in demo builds

- **No sign-in gate:** `/signin` and `/welcome` redirect to `/us/map`.
- **Hidden:** Sign out, Delete account, Sign-in methods. The account menu shows "Guest" and a **Privacy** link only.
- **Banner** at the top of every page: "Demo: changes aren't saved, and reloading starts over." with a link to the GitHub repo. It can't be dismissed.
- **Privacy page** in the demo says nothing leaves the browser.
- **No PWA:** the demo build doesn't register a service worker or offer install, so a visitor never gets a cached old demo.

### GitHub Pages hosting

- **Workflow** `.github/workflows/demo-pages.yml`: on push to `main` (and manual run), `npm ci`, `npm run build` (the unit tests need the shared package and Prisma client built), `npm test`, `npm run build:demo`, then upload and deploy with the official Pages actions (`configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`).
- **Base path:** read from the Pages config by `configure-pages` and passed to the build as `DEMO_BASE_PATH` (`/FamilyPassportMap/` on `bobbyjoecool.github.io`, or `/` on a custom domain), passed to Vite's `base` and to `BrowserRouter`'s `basename`.
- **Deep links:** the build copies `index.html` to `404.html`, so opening `/us/compare` directly (or reloading on it) loads the app instead of GitHub's 404 page.
- **README:** a "Try the demo" link near the top, next to the screenshots.

## Testing Decisions

- **Contract tests (the important ones):** a shared set of API scenarios (create, rename, cap, primary-delete refusal, claim merge, visit add/remove, bulk maps, bad input) runs twice: once against the real server through Supertest, once against the fake API by calling its `fetch`. Both must produce the same statuses and bodies. That's what stops the demo from quietly drifting from the real rules.
- **Unit tests:** the seed is valid (every code exists in the shared reference data, colors are hex, exactly one Primary Person); state resets when the store is recreated; photo resizing produces 256×256.
- **Where the contract lives:** `packages/shared/contract/apiScenarios.ts` (outside `src/`, so it isn't part of the shared package's build). The server runs it in `apps/server/tests/apiContract.test.ts` and the web app in `apps/web/src/demo/apiContract.test.ts`. Ids and timestamps are checked for shape only; everything else must match exactly.
- **E2E:** a Playwright `demo` project (`e2e/demo/demo.spec.ts`) that runs against the built demo, served by `e2e/demo-pages-server.mjs` the way GitHub Pages serves it: under `/FamilyPassportMap/`, with `404.html` and a `404` status for any path that isn't a file. (`vite preview` would answer `index.html` with a `200` and hide a missing `404.html`.) It covers: lands on the map with no sign-in, the banner shows, add a Person and mark a state, reload and they're gone, the 10-People cap, Set as me, photo upload shrunk to 256×256, the seed avatars, the Guest-only menu and demo privacy text, sign-in routes redirect, a deep link loads, no service worker, no API request reaches the network, and phone width.
- The existing unit and E2E suites keep running against the normal build unchanged.

## Out of Scope

- Any server-side demo or shared demo login.
- Saving demo changes between visits.
- Showing Phase 13's sign-in methods in the demo.
- Analytics on demo visits.

## Acceptance criteria

- `npm test` and `npm run test:e2e` (both the normal and the demo projects) pass locally; `npm run build` and `npm run build:demo` pass.
- The normal production build contains no demo code (checked by searching `dist/` for a marker string from `src/demo/`).
- **Manual local checklist** (`npm run build:demo` then `vite preview`):
  1. The app opens on the US map with the sample family and the banner; no sign-in.
  2. Add, rename, recolor, delete, upload a photo, Set as me, and mark visits all work, and the 10-People cap and "can't delete You" behave like the real app.
  3. Reload: everything is back to the sample family.
  4. Account menu has only "Guest" and Privacy.
  5. A deep link to `/world/compare` loads directly.
  6. No service worker is registered.
- After merge, the Pages workflow publishes it and the README link opens it.
- `PHASES.md` marks the phase complete; `CHANGELOG.md` gets a v2.4.0 entry.

## Decisions to carry forward

- **Every new API route needs a fake-API handler and a contract scenario**, or the demo shows that feature as "Not available in the demo." This is the cost of the demo, and it's paid in each later phase.
- **The demo build flag is the only switch.** Pages and components don't check for demo mode (`isDemo()` in `apps/web/src/demoMode.ts`) except the sign-in gate, the account menu, the banner and the privacy text.
- **Photos are shown through `photoUrl()`** (`apps/web/src/api/photos.ts`). Any new place that shows a Person's photo must use it, or the demo's photos won't load there.

## Further Notes

- **Bob does, once:** in the GitHub repo, Settings → Pages → Source: **GitHub Actions**. Optionally a custom subdomain (a `CNAME` record at Porkbun pointing to `bobbyjoecool.github.io`).
- **Why this instead of FitIQ's approach:** FitIQ's guest is a shared demo login on its live backend, reseeded weekly. That fits FitIQ, which is already hosted on GitHub Pages with Supabase behind it. Here it would mean a public login on Bob's home server and visitors seeing each other's changes.

## Open questions (answered 2026-11-19)

1. **Demo address:** `bobbyjoecool.github.io/FamilyPassportMap/`. The build reads the base path from the Pages config, so a custom subdomain later needs only the DNS record and the Pages setting.
2. **Sample family:** the Simpsons' names (Homer, Marge, Bart and Lisa), with Homer as "You".

## Changes made while building

- `photoUrl()` helper in `apps/web/src/api/photos.ts`, used by `PersonAvatar`, because `<img>` requests skip `fetch` (Bob's choice).
- The contract scenarios live in `packages/shared/contract/`.
- The demo E2E serves the build with a GitHub Pages stand-in instead of `vite preview`, so the `404.html` deep-link fallback and the base path are really tested.
- The normal build fails if any demo code is found in `dist/`, instead of a one-off search.
- A root `npm run build:demo` builds the shared package first, as `npm run build` does.
- Built before Phase 13, so Phase 14 is v2.4.0 and Phase 13 moved to v2.5.0 (Bob's call, 2026-11-19).
