# Test Plan — FamilyPassportMap

**Issue:** #18 · **Status:** done (2026-11-18) · **Written:** 2026-11-18

## Where things stand

- **Server unit/integration tests:** good coverage. `apps/server/tests/` has 12 Vitest files (auth, claim, countries, delete account, legacy adoption, ownership, people, photos, primary person, private photos, startup, visits) run against a throwaway SQLite database, with Microsoft sign-in faked at `src/auth/microsoft.ts`.
- **Web app (`apps/web`):** no unit tests and no test runner.
- **Shared package (`packages/shared`):** no tests. `countries.ts` (268 lines) and `usStates.ts` hold the reference data every map and count depends on.
- **End-to-end:** none.

## Goal

Every module has unit tests, and every user-facing flow has an E2E test, per the Testing Requirements in `CLAUDE.md`. Everything runs locally; nothing touches Azure.

## Tooling

| Layer  | Tool                                   | Location                           | Command                       |
| ------ | -------------------------------------- | ---------------------------------- | ----------------------------- |
| Server | Vitest + Supertest (existing)          | `apps/server/tests/`               | `npm test -w apps/server`     |
| Shared | Vitest                                 | `packages/shared/src/**/*.test.ts` | `npm test -w packages/shared` |
| Web    | Vitest + React Testing Library + jsdom | `apps/web/src/**/*.test.tsx`       | `npm test -w apps/web`        |
| E2E    | Playwright                             | `e2e/` at the repo root            | `npm run test:e2e`            |

The root `npm test` is updated to run all three unit workspaces. Claude asks Bob before installing Vitest, Testing Library and Playwright.

## Unit tests to write

### `packages/shared`

1. `countries.ts`: every country has a unique code, a continent from the allowed set, and a display name; lookups by code are case-insensitive if the code expects that; unknown codes return nothing rather than throwing.
2. `usStates.ts`: exactly 50 states (plus DC/territories if the app counts them, matching the spec), unique codes, lookup by code and by name.
3. `person.ts`, `currentUser.ts`, `signIn.ts`: any validation or helper functions, with edge cases (empty names, overlong names, missing fields).

### `apps/web`

1. `api/http.ts`: success returns parsed JSON; non-2xx throws an error carrying the status; 401 is surfaced so the app can send the user to sign-in.
2. `api/people.ts`, `api/visits.ts`, `api/countries.ts`, `api/auth.ts`: each call hits the right method and path with the right body (fetch mocked).
3. `auth/signInPath.ts` and `auth/useCurrentUser.ts`: signed-in, signed-out and loading states; redirect target is preserved.
4. `sections.ts`: section and tab definitions match the routes in `App.tsx`.
5. Components, rendered with Testing Library:
   - `StateCounter`: counts and pluralization (0, 1, many).
   - `ContinentSelector`, `SectionTabs`: selected state and change callbacks.
   - `PersonAvatar`: photo vs. initials fallback.
   - `DeleteAccountDialog`: confirm button stays disabled until the confirmation is typed; cancel closes without calling the API.
   - `UserMenu`: shows the user's name; sign-out and delete-account actions fire.
6. Pages (API mocked): `PeoplePage` (add, rename, delete a person; validation errors), `ListPage`/`WorldListPage` (sorting and empty state), `ComparePage`/`WorldComparePage` (selecting people, shared vs. unique places), `WelcomePage`, `SignInPage`, `PrivacyPage` render.
7. Map components (`UsMap`, `WorldMap`): clicking a region toggles a visit and calls the API; visited regions get the visited style. Mock `react-simple-maps` geography loading so tests don't fetch topojson.

### `apps/server` (gaps only)

1. `access.ts` (222 lines): direct unit tests for each access rule, on top of the route-level ownership tests.
2. `primaryPerson.ts` and `uploads.ts`: edge cases not reached through the routes (oversized upload, wrong MIME type, missing file).
3. `auth/sessions.ts`: expiry and cookie flags (`secure` only in production).

## E2E tests to write

**Sign-in for E2E:** the browser can't use the Vitest mock, so add an E2E-only fake Microsoft provider. When `E2E_FAKE_AUTH=true` (and never when `NODE_ENV=production`; the server refuses to start with both set), the sign-in route redirects to a local page that issues a fake identity, mirroring `tests/helpers.ts`. A Playwright setup project signs in once and saves the storage state.

**Data:** a fresh SQLite file per run, migrated with `prisma migrate deploy` in Playwright's global setup, then seeded with two test users and a few people.

**Flows** (one spec file each):

1. `auth.spec.ts`: signed-out visitor lands on Welcome; sign-in sends them to the US map; sign-out returns to Welcome; a protected route while signed out redirects to sign-in and back after.
2. `people.spec.ts`: add a person, rename, upload a photo, delete; validation error on an empty name.
3. `us-map.spec.ts`: mark and unmark a state by clicking it; the state counter updates; the visit survives a reload.
4. `us-compare.spec.ts` and `us-list.spec.ts`: compare two people; list sorting and empty state.
5. `world-map.spec.ts`, `world-compare.spec.ts`, `world-list.spec.ts`: the same flows for countries, including the continent selector.
6. `privacy.spec.ts`: private photos aren't visible to a second signed-in user (two browser contexts).
7. `delete-account.spec.ts`: delete account removes the user's data and signs them out.
8. `mobile.spec.ts`: the main screens at a phone viewport (navigation reachable, map usable).

## Order of work

1. Claude adds Vitest to `packages/shared` and writes its tests.
2. Claude adds Vitest + Testing Library to `apps/web` and writes the `api/` and `auth/` tests.
3. Claude writes the component and page tests.
4. Claude adds the E2E fake-auth seam on the server, with a unit test proving it's refused in production.
5. Claude sets up Playwright (config, global setup, seeded database, auth setup project).
6. Claude writes the E2E specs in the order above.
7. Claude fills the server gaps.
8. Claude updates `CLAUDE.md`'s Testing Requirements (and the README, if it describes testing) with the final commands.

## Done when

- `npm test` runs server, shared and web unit tests, and all pass.
- `npm run test:e2e` runs every flow above locally and passes.
- No test reaches Azure or real Microsoft sign-in.

## What was built (2026-11-18, #18)

All of the above is done: `npm test` runs 42 shared, 136 web and 194 server tests, and `npm run test:e2e` runs 31 Playwright tests. Where the code differed from this plan's assumptions, the tests follow the code:

- **Shared:** the reference data has no lookup functions, so the tests check the tables and maps themselves (`COUNTRIES`, `COUNTRY_CODES`, `ISO_NUMERIC_TO_ALPHA2`, `countriesByContinent`, `US_STATES`, `FIPS_TO_USPS`). `currentUser.ts` holds only types, so it has no tests.
- **Web components:** `DeleteAccountDialog` has no typed confirmation. Its tests cover Cancel, Escape, a successful delete, a failed delete, and the locked state while deleting. `StateCounter` doesn't pluralize ("1/50 states").
- **Web pages:** the List pages have no sorting (states are alphabetical; countries are grouped by continent), and Compare draws maps side by side with no shared-vs-unique summary. The tests check the order, who appears on each row, and which places are filled on each map. A List page's empty state appears only with no People, which a signed-in User can't have (they always have their own Person), so it is covered by unit tests only.
- **Maps:** the real `react-simple-maps` and bundled topology render in jsdom (nothing is fetched), so the map tests use them instead of a mock. Map shapes now carry `data-state-code` / `data-country-code` so tests can find a specific state or country.
- **Navigation seam:** full page loads go through `apps/web/src/navigation.ts` (`loadPage`), because jsdom can't spy on `window.location`.
- **E2E database:** `e2e/start-server.mjs` creates and migrates the fresh database before starting the API server, not Playwright's global setup, so it's ready before the first request. Its data folder is `e2e/test-data`, because Express's `sendFile` refuses any path that contains a dot-folder.
- **E2E users:** tests that change data sign in as a brand-new User each time. Only read-only specs share the seeded `alice` and `bob` (from `e2e/auth.setup.ts`), so specs can run in parallel.
- **Bug fixed along the way:** `parseSectionPath` treated `/usa…` and `/worldwide…` as the US and World sections.
