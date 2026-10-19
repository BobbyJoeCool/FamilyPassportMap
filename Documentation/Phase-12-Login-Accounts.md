# Phase 12 (v2.3.0) — Login & Accounts

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.
>
> **Where the tickets live:** per ADR 0001, this spec stays here and its implementation tickets are GitHub issues linked from this doc and from the `PHASES.md` row.

## Tickets

These are GitHub issues with native blocking links. #1–#4 can start right away; once #5 is done, #6, #8, #9 and #10 can run in parallel.

| # | Ticket | Blocked by |
|---|---|---|
| #1 | Prefactor: route every Person lookup through one access-policy module | — |
| #2 | Privacy page | — |
| #3 | Shrink photos to 256×256 avatars | — |
| #4 | Google sign-in, sessions and the sign-in gate | — |
| #5 | Each User sees only the People they own, with a 10-People cap | #1, #4 |
| #6 | Welcome step and Primary Person | #5 |
| #7 | Set as me: Claim one of your own People | #6 |
| #8 | Private photos | #5 |
| #9 | Delete account | #5 |
| #10 | Legacy data adoption for the site owner | #5 |
| #11 | Set up Google OAuth client and Azure app settings *(ready-for-human)* | #2 |
| #12 | Release v2.3.0 | #3, #7, #8, #9, #10, #11 |

## App overview (full context)

FamilyPassportMap is a web app for tracking which places each member of a family has visited. Each Person has a name, a required color (any hex, no fixed palette) and an optional profile photo. Visited places fill in with that color on maps.

The app has three sections, each with shared sub-tabs:
- **People**: add, edit and delete People.
- **US**: Map, Compare and List for the 50 states.
- **World**: Map, Compare and List for 195 countries. The map zooms one continent at a time.

State visits and country visits are tracked separately.

**Stack:**
- **Front end:** React, TypeScript, Vite and Tailwind. It's an installable PWA whose service worker caches only the app shell.
- **Back end:** a Node and Express API in TypeScript, with Prisma 7 on SQLite.
- **Shared code:** a package holding the types and reference data.
- **Repo layout:** npm workspaces (`apps/server`, `apps/web`, `packages/shared`).

**Hosting:** one Azure App Service on the **Free (F1)** tier. **Hosting cost must stay $0.** F1 always runs a single instance, which is what keeps SQLite safe. The database and uploaded photos live under a persistent `DATA_DIR` (`/home/data` in production). Every push to `main` deploys through GitHub Actions. All testing is local; never test against the Azure deployment.

**Until now there has been no login.** The app is a single-household tool: every API route returns everyone's data, and photos are served publicly from `/uploads/*`.

## Carried over from previous phases

- **Data model**:
  - `Person` has `id`, `name`, `colorHex`, an optional `profilePicturePath` and `createdAt`.
  - `VisitedState` has `personId`, a 2-letter `stateCode` and `visitedAt`, and is unique per person and state.
  - `VisitedCountry` has `personId`, an ISO alpha-2 `countryCode` and `visitedAt`, and is unique per person and country.
  - Deleting a Person deletes their visits.
  - States and countries are deliberately separate, parallel models.
- **API**:
  - People: `GET`, `POST`, `PATCH /:id`, `DELETE /:id` and `POST /:id/photo` under `/api/people`.
  - Each person's states: `GET`, `PUT /:code` and `DELETE /:code` under `/api/people/:id/visits`.
  - Each person's countries: `GET`, `PUT /:code` and `DELETE /:code` under `/api/people/:id/countries`.
  - Bulk maps of person → codes for everyone: `GET /api/visits` and `GET /api/countries`.
  - `GET /api/health`.
- **Errors**: the API returns a JSON body `{ error }` on failure, and the client's shared response handler throws an `Error` carrying that message.
- **Photos**: JPEG, PNG or WebP up to 5 MB, stored under `DATA_DIR/uploads/` and served statically at `/uploads/*`.
- **Dev**: the web dev server proxies `/api` and `/uploads` to the API on port 3001.
- **Tests**: server tests run with Vitest and Supertest against the exported Express app, using a temporary SQLite database that is migrated once and wiped before each test.
- **Production data**: production holds one family's data (several People, with visits and photos) that must survive this phase.

## Domain language

These terms come from the project glossary (`CONTEXT.md`) and are used precisely throughout this doc:

- **User**: someone who signs in.
- **Owner**: the User a Person belongs to. Every Person has exactly one Owner.
- **Person**: someone whose travels are tracked. People don't sign in; Users do.
- **Primary Person**: the Person who *is* the User. Every User has exactly one. It can be replaced (by Claim) but never deleted on its own.
- **Claim**: a User making an existing Person their Primary Person, which merges in and deletes their old Primary Person. In this phase only a Person the User already owns can be Claimed. The UI calls this **"Set as me"**.
- **Link**, **Join**, **Family**: defined in the glossary but **not built in this phase** (see Decisions to carry forward).

## Problem Statement

Anyone who opens the app's URL sees, and can change, every Person, visit and photo. Photos of real family members, including children, can be opened by anyone with the link. A second household can't use the app without mixing its People with the first. There's no way to say "this is me", so later features (letting another household see your maps, giving a grown child their own account) have nothing to build on.

## Solution

People sign in with their Google account. Each User sees and manages only the People they own. Signed-out visitors see only a sign-in page and a short privacy page, and photos are private too. On first sign-in, a short welcome step creates the User's Primary Person from their name and a chosen color. Any Person they own can later be made "me" with Set as me.

Anyone with a Google account can sign up. To keep the free host safe, each User may own at most 10 People, and every photo is shrunk to a small avatar.

The existing family's data is attached to the site owner's account on their first sign-in. Users can sign out, and can permanently delete their account and everything in it.

## User Stories

### Signing in and out

1. As a visitor who isn't signed in, I want every page to send me to a sign-in page, so that nobody can see or change data without an account.
2. As a visitor, I want to sign in with my Google account, so that I don't have to create or remember another password.
3. As a visitor, I want to read a short privacy page from the sign-in screen before signing in, so that I know what the app stores about me and my family.
4. As a visitor, I want to see a short message if I cancel Google sign-in or it fails, so that I know to try again rather than staring at a blank page.
5. As a visitor whose Google email isn't verified, I want to be told sign-in can't continue, so that I understand why I wasn't let in.
6. As a User, I want to stay signed in for 30 days after my last visit, so that opening the installed app on my phone doesn't make me sign in every time.
7. As a User, I want my session renewed as I keep using the app, so that I'm not signed out mid-use just because 30 days have passed since I first signed in.
8. As a User whose session has expired, I want my next action to take me to sign-in and then back to the page I was on, so that I don't lose my place.
9. As a User, I want to see my Google name and photo in the header, so that I know which account I'm signed in with.
10. As a User, I want a Sign out option in the header menu, so that I can leave a shared device safely.
11. As a User who has signed out, I want the next person on that device to see the sign-in page, not my family, so that my data stays private.
12. As a User, I want links that sent me to sign-in to only return me to pages inside this app, so that a crafted link can't bounce me to another site.

### First sign-in and the Primary Person

13. As a new User, I want a one-time welcome step asking for my name (prefilled from Google) and my color, so that I appear on the maps as myself from the start.
14. As a new User, I want the welcome step to require a color just like adding any Person, so that every Person on the map has a color I chose.
15. As a new User, I want to start with no other People after the welcome step, so that I add exactly the family members I want.
16. As a new User, I want my Google photo *not* copied into the app automatically, so that only photos I choose to upload are stored.
17. As a User, I want my Primary Person marked as "You" on the People page, so that I can tell myself apart from the People I manage.
18. As a User, I want to edit my Primary Person's name, color and photo like any other Person, so that I can fix how I appear.
19. As a User, I want the app to refuse to delete my Primary Person and explain that deleting my account is the way to remove it, so that I never end up as a User with no "me".
20. As a User who already added myself as an ordinary Person (or got one from migrated data), I want "Set as me" on that Person, so that it becomes my Primary Person without re-entering my visits.
21. As a User using Set as me, I want any states and countries marked on my old Primary Person added to the one I'm Claiming, so that nothing I marked is lost.
22. As a User using Set as me, I want my old Primary Person removed afterwards, so that I don't appear twice.
23. As a User, I want Set as me unavailable on my current Primary Person, so that the option only appears where it does something.
24. As a User who abandons the welcome step and comes back later, I want to be returned to the welcome step, so that I can't use the app without a Primary Person.

### Owning and seeing People

25. As a User, I want the People page to show only People I own, so that other households' People never appear in my lists.
26. As a User, I want US and World Map, Compare and List to show only my People's visits, so that every view is about my family alone.
27. As a User, I want the state and country counts and lists to count only my People, so that the numbers mean something.
28. As a User, I want to add, edit and delete my own People exactly as before, so that signing in doesn't change how the app works day to day.
29. As a User, I want to mark and unmark states and countries for my People exactly as before, so that tracking travel is unchanged.
30. As a User, I want a clear message when I try to add an 11th Person, so that I understand the 10-People limit instead of hitting a silent failure.
31. As a User, I want the limit to include my Primary Person (me plus 9 others), so that the rule is simple to explain.
32. As a User, I want any attempt to open, change or mark visits on someone else's Person to act as if that Person doesn't exist, so that nobody can even confirm another household's data exists.

### Photos

33. As a User, I want photos of my People visible only to me while signed in, so that pictures of my children aren't public on the internet.
34. As a User, I want an uploaded photo shrunk to a small avatar automatically, so that uploads are fast and the free host doesn't run out of space.
35. As a User, I want to keep uploading JPEG, PNG or WebP photos up to 5 MB, so that photos straight from my phone still work.
36. As a signed-out visitor or another User, I want a photo URL that isn't mine to come back as not found, so that photo URLs can't be used to probe whose data exists.
37. As the site owner, I want photos uploaded before this phase shrunk too, so that every avatar is consistent and old large files stop using disk.

### Deleting an account

38. As a User, I want "Delete account" in the header menu, so that I can leave the app and take my data with me.
39. As a User, I want a confirmation that spells out what will be permanently deleted (my account, all my People, their visits and photos) before anything happens, so that I can't delete everything by accident.
40. As a User who deleted their account, I want to land on the sign-in page signed out, so that it's clear the account is gone.
41. As a User who deleted their account, I want signing in again with the same Google account to start fresh as a new User, so that deletion really did remove everything.

### The existing family's data

42. As the site owner, I want all People already in the app attached to my account the first time I sign in, so that nothing my family recorded before login is lost.
43. As the site owner, I want that attachment tied to my Google email in an app setting, so that no other sign-up can take the existing data.
44. As the site owner, after my data is attached, I want to use Set as me on the Person who is me, so that my migrated self becomes my Primary Person with all my visits.
45. As any other new User, I want to start with only my own Primary Person, so that I never see the original family's data.
46. As the site owner, I want People with no Owner to stay invisible to everyone until I sign in, so that the data is private during the gap between deploying and my first sign-in.

### Running and developing the app

47. As the developer, I want sign-in to work against `localhost` with a Google client set up for local development, so that I can test everything locally as the project requires.
48. As the developer, I want the server to fail clearly at startup in production if Google sign-in isn't configured, so that a missing setting is caught at deploy rather than when someone tries to sign in.
49. As the developer, I want every "can this User see / change this Person?" decision made in one place, so that adding Link and Join later changes one module instead of every route.
50. As the developer, I want tests to sign in as any fake User without contacting Google, so that the access rules can be tested quickly and reliably.

## Implementation Decisions

### Sign-in flow

- **Provider:** Google only, using the server-side **authorization code flow** with redirects. Scopes are `openid email profile`. A redirect flow is used instead of a popup or One Tap because popups are unreliable in installed (standalone) PWAs, especially on iOS.
- **Routes:**
  - `GET /api/auth/google?returnTo=<path>` sends the browser to Google.
  - `GET /api/auth/google/callback` handles Google's response.
  - `POST /api/auth/signout` ends the session.
- **CSRF protection:** a random `state` value is set in a short-lived httpOnly cookie and checked on the callback.
- **`returnTo`:** only a same-origin relative path (starting with a single `/`) is accepted. Anything else falls back to the default landing page `/us/map`.
- **Google identity adapter.** The callback hands Google's authorization code to one small module. It exchanges the code, verifies the ID token, and returns `{ subject, email, emailVerified, name, pictureUrl }`. This is the only code that talks to Google, and it's the one thing tests replace with a fake. Use Google's official library or a standard OpenID Connect client.
- **Callback outcomes:**
  - **Success:** find or create the User by `(authProvider = "google", authSubject = subject)` and refresh their email, display name and avatar URL. Run the legacy-data adoption check (below). Start a session.
  - **Redirect after success:** to `/welcome` if the User has no Primary Person yet, otherwise to `returnTo`.
  - **Cancelled at Google:** redirect to `/signin?error=cancelled`.
  - **Exchange or verification failed:** redirect to `/signin?error=failed`.
  - **Unverified email:** redirect to `/signin?error=unverified`, and create no User.
- **Configuration:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL` (used to build the redirect URI; `http://localhost:5173` locally, through the existing dev proxy) and `LEGACY_DATA_OWNER_EMAIL`. In production, the server refuses to start without the first three.

### Sessions

- **Storage:** sessions are server-side rows in SQLite. The cookie holds a random token, and the database stores only a SHA-256 hash of it, so a leaked database can't be used to sign in.
- **Cookie:** httpOnly, `SameSite=Lax`, `Secure` in production, path `/`. Lax also stops other sites from making state-changing requests, so no separate CSRF token is needed for the API.
- **Lifetime:** 30 days, sliding. Each authenticated request pushes the expiry to now + 30 days, but writes to the database at most once a day per session. Expired sessions are treated as missing and can be cleaned up lazily.
- **Ending a session:** signing out deletes the session row and clears the cookie. Deleting the account deletes all of that User's sessions.

### Authorization

- **Signed-out requests:** every `/api/*` route except `/api/health` and `/api/auth/*` requires a signed-in User. Without one, the response is `401 { error: "Not signed in" }`.
- **One central access policy module** answers "which People can this User view?" and "can this User view / edit this Person?". In this phase both mean "the User is the Person's Owner". **Every** route that touches a Person, its visits or its photo goes through this module, and no route filters Person queries by owner on its own. When Link and Join arrive, only this module changes (see ADR 0002).
- **Other Users' People:** a Person that exists but isn't viewable or editable by the User gets the same `404` as one that doesn't exist.
- **Lists and bulk maps:** the People list and both bulk visit maps (`GET /api/visits`, `GET /api/countries`) return only People the User can view.

### Schema changes

- **New `User` model:**
  - Fields: `id`, `authProvider`, `authSubject`, `email`, `displayName`, an optional `avatarUrl` (Google's picture URL, used only in the header) and `createdAt`.
  - `(authProvider, authSubject)` is unique. Storing the provider separately leaves room for more sign-in providers later without a data change.
  - An optional, unique `primaryPersonId` points to a Person. It's null only between first sign-in and finishing the welcome step. If that Person is deleted, it's set back to null; in practice only the Claim flow ever deletes a Primary Person, inside the same transaction that sets the new one.
- **`Person`** gains `ownerId`, which points to a User and is deleted along with that User. It's **nullable** only so pre-login People can exist with no Owner until adoption. After adoption, every Person has an Owner, and every new Person is created with one.
- **New `Session` model:** `id` (the token hash), `userId` (deleted along with the User), `expiresAt` and `createdAt`.
- **Docs:** the ERD diagram must be updated in the same change as the schema, per the project's diagram rules.

### API changes

- `GET /api/me` → `{ user: { id, email, displayName, avatarUrl }, primaryPersonId: string | null }`, or `401`.
- `POST /api/me/primary-person` with `{ name, colorHex }` (the same rules as creating a Person) creates the Primary Person and returns it. It returns `409` if the User already has one. This endpoint does not count against the 10-People cap, so the legacy owner can always finish the welcome step.
- `DELETE /api/me` permanently deletes the User and everything they own: People, visits, photo files and sessions. It clears the cookie and returns `204`.
- `POST /api/people` returns `409 { error: "You can have up to 10 people, including yourself." }` when the User already owns 10.
- `POST /api/people/:id/claim` performs **Set as me**. It needs a Person the User owns that isn't already their Primary Person. In one transaction it:
  1. copies every state and country on the old Primary Person that the target lacks, keeping the original `visitedAt`;
  2. sets the target as the Primary Person;
  3. deletes the old Primary Person and its photo file.

  It returns the updated Person.
- `DELETE /api/people/:id` on the User's Primary Person returns `409 { error: "This is you, so it can't be deleted. To remove it, delete your account." }`.
- The `Person` API shape gains `isPrimary: boolean`.
- All other People, visit and country endpoints keep their current contracts, now scoped through the access policy.

### Photos

- **Access:** `/uploads/*` stops being public static hosting. A request is served only if a signed-in User can view the Person whose photo it is. In every other case (signed out, someone else's, missing), the response is `404`.
- **Shrinking on upload:** the 5 MB, JPEG/PNG/WebP upload limit stays. Each upload is center-cropped to a square and resized to **256×256** in **its original format**, so file extensions and stored paths never change. Use `sharp` (it runs on Azure's Linux App Service).
- **Shrinking existing photos:** a startup step that is safe to run more than once shrinks any photo in the uploads folder larger than 256 px on either side, in place. On later starts it finds nothing to do.

### Legacy data adoption

- On every successful sign-in, check two things: is the User's verified email equal to `LEGACY_DATA_OWNER_EMAIL` (case-insensitive), and are there People with no Owner? If both, make that User the Owner of all of them. This is safe to repeat and needs nothing else to be run.
- Adoption ignores the 10-People cap. Adopted People are ordinary (non-Primary) People. The owner then completes the welcome step like everyone else and uses Set as me on their own Person.
- If the setting is unset, no adoption happens and People with no Owner stay invisible.

### Web app

- **Sign-in check on load.** The app calls `GET /api/me` and lands in one of four states:
  - **loading**;
  - **signed out** → `/signin?returnTo=<current path>`;
  - **needs welcome** → `/welcome`;
  - **ready**.
- **Public routes:** only `/signin` and `/privacy`.
- **Expired sessions:** the shared response handler treats any `401` as an expired session and sends the browser to `/signin?returnTo=<current path>`.
- **Sign-in page:** the app name, a "Sign in with Google" button (a link to the start route), a link to the privacy page, and a short message for each `error` value:
  - `cancelled`: "Sign-in was cancelled."
  - `failed`: "Sign-in didn't work. Please try again."
  - `unverified`: "Your Google email isn't verified, so we can't sign you in."
- **Welcome page:** a name field prefilled from Google, the existing color picker (required) and Continue. It creates the Primary Person, then goes to `/us/map`.
- **Privacy page:** plain language covering:
  - what is stored (Google name, email and picture URL; your People, their visits and photos);
  - who can see it (only you, while signed in);
  - photos being shrunk;
  - how to delete everything (Delete account).
- **Header account menu:** your Google avatar and name, then **Sign out** and **Delete account**. Delete account opens a confirmation dialog that lists what will be permanently deleted. Its destructive button is labelled "Delete my account".
- **Leaving the app:** both Sign out and Delete account end with a full page load to `/signin`, so nothing from the previous User stays in memory. The service worker keeps caching only the app shell, never `/api/*` or `/uploads/*`.
- **People page:**
  - the Primary Person gets a "You" badge and no delete control;
  - every other Person gets a **Set as me** action with a short confirmation explaining the merge;
  - at 10 People the add form is disabled and shows the cap message.

## Testing Decisions

- **What makes a good test:** it checks behavior a client can observe through the HTTP API (status codes, response bodies, what a later request returns), never internal function calls or database layout. A test should still pass if the access policy, session storage or image code were rewritten.
- **Seams (agreed):**
  1. **HTTP API through Supertest** is the main seam, as today. Nearly everything is tested here.
  2. **The Google identity adapter** is the only fake. A test helper signs in as a named fake User by driving the callback with a faked identity, then returns a Supertest agent carrying that session cookie.
  3. **The startup step that shrinks existing photos** is tested by calling it directly on a temporary uploads folder, since startup isn't reachable through HTTP.
- **What to cover:**
  - Signed-out requests get `401` on every protected route and `404` on `/uploads/*`.
  - **Isolation between two Users.** Bob can't list, read, edit, delete, mark visits on, or fetch the photo of Alice's People (all `404`), and his bulk maps don't include them.
  - Sign-in creates the User. A second sign-in with the same subject reuses it. An unverified email creates no User.
  - `returnTo` rejects outside URLs.
  - Welcome: `/api/me` reports no Primary Person until it's created, and creating a second one returns `409`.
  - The cap: the 11th Person is refused, and the Primary Person counts.
  - Set as me: visits are merged, the old Primary Person is gone, the new one shows `isPrimary`, and Set as me on someone else's Person returns `404`.
  - Deleting the Primary Person is refused with the message above.
  - Delete account removes People, visits, photo files and sessions; the old cookie then gets `401`; signing in again creates a fresh User.
  - Sign-out ends the session.
  - An uploaded photo comes back 256×256.
  - Legacy adoption: with the setting matching, unowned People become the owner's on sign-in; another User adopts nothing; with the setting unset, nothing changes.
  - Sliding expiry: an expired session is refused.
- **Existing tests:** the People, visits and countries test files keep their cases but run as a signed-in User. The per-test reset must also clear Users and Sessions.
- **Prior art:** the existing server test files and the shared test setup (temporary SQLite database, migrations applied once, tables wiped before each test).
- **The web app** has no automated tests, as before. Its behavior is checked by the manual local checklist in the acceptance criteria.

## Out of Scope

- **Link** (two-way, view-only connections between Users), **Join** and **Family** (a group of Users who manage each other's People, with an editable Family name), and **Claim across a Family**, which needs the Owner's approval. Giving a family member their own account (they sign up, Join and Claim) comes with these.
- Sign-in providers other than Google, and email/password sign-in.
- Admin screens. The site owner manages Users directly in the database if ever needed.
- Rate limiting or abuse detection beyond the 10-People cap and photo shrinking.
- Offline use of data.
- Copying the Google profile photo into a Person.
- Changing which email owns the legacy data after adoption.

## Acceptance criteria

- All new and existing server tests pass locally (`npm test`), and the build passes (`npm run build`).
- **Manual local checklist** (dev servers running, with a Google OAuth client configured for `http://localhost:5173`):
  1. Signed out: every app URL goes to `/signin`; `/privacy` opens; a photo URL returns 404.
  2. Sign in with Google: the welcome step appears with the name prefilled; Continue is blocked without a color; after Continue you land on the US map, and People shows only you, marked "You".
  3. Cancel at Google: you're back on `/signin` with the cancelled message.
  4. Add People up to 10: the add form disables and shows the cap message.
  5. Set as me on another Person: their visits now include your old visits; the old "You" is gone.
  6. Try to delete your Primary Person: it's refused with the explanation.
  7. A second Google account in a private window sees none of the first account's People, maps, lists or photos.
  8. With `LEGACY_DATA_OWNER_EMAIL` set to your email against a copy of the pre-login database, your first sign-in shows all existing People. You can Set as me on yourself, and the other account still sees nothing of yours.
  9. Existing large photos are shrunk after a server start.
  10. Sign out: you're back at `/signin`, and Back doesn't show data.
  11. Delete account: the confirmation lists what's deleted, you end up signed out, and signing in again starts fresh.
- The ERD diagram matches the new schema (User, Session, Person.ownerId).
- `README.md` no longer says there is no login, and describes signing in, the cap and deleting an account.
- `PHASES.md` marks the phase complete. `CHANGELOG.md` gets a v2.3.0 entry.

## Decisions to carry forward to the Link/Join phase

- **The access policy module is the extension point.** Link adds "can view" for Linked Users' People. Join adds "can view and edit" for every Person owned by a member of the same Family. Routes shouldn't need to change.
- **Ownership never moves to a group.** Every Person keeps exactly one Owner (ADR 0002). A Family groups Users and has a name its members can edit. Leaving a Family takes the People you own.
- **Claim across a Family** reuses this phase's Set as me merge (copy missing visits, delete the old Primary Person, become Owner), and adds a request the current Owner must approve. A Person that is already someone's Primary Person can't be Claimed. Giving a family member their own account = they sign up, Join, then Claim their Person, which makes them its Owner.
- **The 10-People cap** applies per Owner, not per Family.
- **The auth provider is stored as a column**, so adding another provider is a code change only.

## Further Notes

- **Google setup (done by the user, not by Claude):** create a Google Cloud project and an OAuth client (web application). Its authorized redirect URIs are `http://localhost:5173/api/auth/google/callback` and `https://<app>.azurewebsites.net/api/auth/google/callback`. The OAuth consent screen needs the privacy page URL, and must be **published to production**: in "Testing" mode only listed test users (up to 100) can sign in. The basic scopes `openid email profile` don't need Google's verification review. The `/wizard` skill is a good fit for scripting this, along with adding the Azure app settings (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`, `LEGACY_DATA_OWNER_EMAIL`).
- **Deploy order:** set the Azure app settings before the deploy that includes this phase. Otherwise the production server will refuse to start (by design). Between the deploy and the owner's first sign-in, existing People exist but nobody can see them.
- **Free-tier storage:** the F1 tier has about 1 GB of disk. Avatars of 256 px are tens of KB each, so even many Users at 10 People each use only a small part of it.
- **Related records:** `CONTEXT.md` (glossary); `docs/adr/0001-specs-in-documentation-tickets-in-github.md`; `docs/adr/0002-people-have-one-owner-families-group-users.md`.
- **Version:** v2.3.0 follows the post-v2.0 pattern (v2.1.0, v2.2.0). If login should instead open a new round leading to v3.0.0 (Phase 12 now, with Link/Join as later phases, then a v3.0.0 stabilization pass), renumber before tickets are cut.
