# Phase 13 (v2.5.0) — Sign-in Methods and Move to Voyager

> **Portability note:** This document is self-contained. It can be handed to a fresh Claude Desktop (or any LLM) session with **no access to the repository** and still contain everything needed to design this phase in detail. When the resulting design is brought back into the repo, Claude Code should reconcile it against this file and against `PHASES.md`.
>
> **Where the tickets live:** per ADR 0001, this spec stays here and its implementation tickets are GitHub issues linked from this doc and from the `PHASES.md` row. Tickets are cut once Bob approves this spec.

**Status:** Draft, written 2026-11-19 from Bob's answers. On 2026-11-20 the Voyager move (formerly `docs/VOYAGER-DEPLOY.md`) was folded in, so this phase covers both: the new sign-in methods and moving the app from Azure to Voyager. The questions still open are listed at the end.

## Tickets

Not cut yet.

## App overview (full context)

FamilyPassportMap is a web app for tracking which places each member of a family has visited. Each Person has a name, a required color and an optional profile photo. Visited places fill in with that color on maps.

The app has three sections, each with shared sub-tabs:
- **People**: add, edit and delete People.
- **US**: Map, Compare and List for the 50 states.
- **World**: Map, Compare and List for 195 countries, zoomed one continent at a time.

**Stack:** React, TypeScript, Vite and Tailwind on the front end (an installable PWA that caches only the app shell). A Node and Express API in TypeScript with Prisma 7 on SQLite. A shared package for types and reference data. npm workspaces: `apps/server`, `apps/web`, `packages/shared`.

**Hosting:** today, one Azure App Service on the Free tier. This phase moves the app to **Voyager**, Bob's home server (a 2011 MacBook Pro running Docker behind a Cloudflare tunnel), at `https://passport.bobbyjoecool.dev` (see "Move to Voyager" below). Every provider's callback URL and the passkey domain are registered once, for that address. Hosting cost must stay $0. All testing is local. The guest demo (Phase 14) stays on GitHub Pages and isn't affected.

## Carried over from previous phases

- **Accounts (Phase 12):** a **User** signs in and owns their **People**. Each User has exactly one **Primary Person** (themselves), created by a one-time welcome step. Every Person has exactly one Owner. Up to 10 People per User. **Delete account** removes the User and everything they own.
- **Sign-in today:** Microsoft only, through a server-side authorization-code redirect flow (`GET /api/auth/microsoft`, `GET /api/auth/microsoft/callback`). The ID token is verified with `jose`. `apps/server/src/auth/microsoft.ts` is the only code that talks to Microsoft, and tests replace it with a fake.
- **Users are keyed by provider + subject, never by email.** `User` has `authProvider` (always `"microsoft"`), `authSubject`, `email`, `displayName`, `avatarUrl`, `primaryPersonId`. `(authProvider, authSubject)` is unique.
- **Sessions:** server-side rows. The cookie holds a random token and the database stores its SHA-256 hash. httpOnly, `SameSite=Lax`, `Secure` in production. 30 days, sliding.
- **Legacy data adoption:** the User whose *personal* Microsoft account email matches `LEGACY_DATA_OWNER_EMAIL` Adopts People with no Owner on sign-in.
- **Access policy:** `apps/server/src/access.ts` decides every "can this User see or change this Person?". This phase doesn't touch it.
- **E2E fake sign-in:** with `E2E_FAKE_AUTH=true` (refused in production), sign-in goes to a local fake page instead of Microsoft.

## Domain language

New terms (added to `CONTEXT.md`):

**Sign-in method**: one way a User can sign in: a Microsoft, Google or GitHub account, a passkey, or an email address that receives one-time codes. A User has one or more. Each sign-in method belongs to exactly one User.
_Avoid_: Login, identity, credential, provider (a provider is only Microsoft, Google or GitHub)

**Email code**: a short one-time code sent to an email address, typed in to prove the person controls that address.
_Avoid_: Magic link, OTP, password

## Problem Statement

Sign-in only works with a Microsoft account. Family members who use Google, GitHub or no big-tech account at all can't get in, and someone who loses access to their one Microsoft account loses their data.

The app also runs on Azure's Free tier, which is slow and keeps running out of disk during deploys. Bob's home server, Voyager, already hosts his other apps for free.

## Solution

Offer five sign-in methods: **Microsoft**, **Google**, **GitHub**, **passkey** and **email code**. Any of them can create a new account. Once signed in, a User can add more sign-in methods to the same account from a new **Sign-in methods** page in the account menu, and remove ones they no longer want, as long as at least one is left.

Apple sign-in is left out for now (it needs a $99/year Apple Developer Program membership).

Move the app from Azure to Voyager in the same phase, keeping the existing database, photos and Microsoft sign-in. Every new provider's callback and the passkey domain are then registered once, for `passport.bobbyjoecool.dev`, instead of once for Azure and again after a later move.

## User Stories

### Signing in
1. As a visitor, I see buttons for Microsoft, Google and GitHub, a "Sign in with a passkey" button, and an email field, so I can use whatever I have.
2. As a visitor, a provider button only appears when that provider is set up on the server, so I never click a broken button.
3. As a visitor with no account, signing in with any method creates my account and takes me to the welcome step.
4. As a returning User, signing in with any method on my account takes me into my account.
5. As a visitor using email, I type my email, get a 6-digit code, type it in, and I'm in. If the email isn't on any account yet, that creates a new account.
6. As a visitor using a passkey, my device shows its passkey prompt without my typing anything; if I have no passkey for this site I can create an account with a new one.

### Managing sign-in methods
7. As a User, I open **Sign-in methods** from the account menu and see every method on my account: kind, the account's email or the passkey's name, when it was added, and when it was last used.
8. As a User, I can add a Microsoft, Google or GitHub account, which sends me through that provider and back.
9. As a User, I can add a passkey and give it a name ("Bob's iPhone").
10. As a User, I can add an email address by confirming a code sent to it.
11. As a User, I can remove any sign-in method except my last one.
12. As a User, if I try to add a sign-in method that already belongs to another account, I'm told so and nothing changes. Accounts are never merged.
13. As a User, I can rename a passkey.

### Existing accounts
14. As an existing Microsoft User, I keep signing in with Microsoft exactly as before, and my account shows Microsoft as its one sign-in method.

### The move
15. As a User, I open `https://passport.bobbyjoecool.dev` and find all my People, visits and photos, exactly as they were on Azure.
16. As Bob, I update the app on Voyager by building an image and restarting one container. New database migrations apply on their own.

## Implementation Decisions

### Schema changes

- **New `SignInMethod` model** replaces `User.authProvider` / `User.authSubject`:
  - `id`, `userId` (cascade delete with the User), `kind` (`"microsoft" | "google" | "github" | "email"`), `subject`, `email` (nullable), `createdAt`, `lastUsedAt`.
  - `subject` is the provider's stable user id for providers, and the lowercased, trimmed address for `email`.
  - `(kind, subject)` is unique, which is what makes "already belongs to another account" a database guarantee.
- **New `Passkey` model:** `id`, `userId` (cascade), `credentialId` (unique, base64url), `publicKey` (bytes), `signCount`, `transports` (nullable, JSON string), `name`, `createdAt`, `lastUsedAt`. Passkeys get their own table because they carry key material a provider identity doesn't.
- **New `EmailCode` model:** `id`, `email` (lowercased), `codeHash` (SHA-256), `purpose` (`"sign-in" | "add-email"`), `userId` (nullable; set for `add-email`), `expiresAt`, `attempts`, `createdAt`.
- **`User`:** drop `authProvider` and `authSubject`. `email` becomes nullable (a passkey-only account has none). `email` and `displayName` stay as display values, refreshed from whichever provider was just used.
- **Migration:** one Prisma migration copies each existing User's `(authProvider, authSubject, email)` into a `SignInMethod` row, then drops the two columns. Existing Microsoft sign-ins keep working with no action from anyone.
- **ERD:** `docs/diagrams/ERD.mmd` is updated in the same change.

### Providers (Microsoft, Google, GitHub)

- Same shape as today's Microsoft flow, generalized: `GET /api/auth/:provider?returnTo=<path>&intent=sign-in|add` and `GET /api/auth/:provider/callback`. `state` is checked against a short-lived cookie, as now. The cookie also records the intent.
- One adapter module per provider (`microsoft.ts` stays; new `google.ts`, `github.ts`), each returning `{ subject, email, name, avatarUrl, emailVerified }`. These are the only code that talks to each provider, and the seam tests fake.
  - **Google:** OpenID Connect, scopes `openid email profile`, ID token verified with `jose`. `subject` is `sub`.
  - **GitHub:** OAuth app, scope `read:user user:email`. No ID token, so the adapter calls `GET /user` and `GET /user/emails` with the access token, and uses the primary verified email. `subject` is the numeric user id.
- **Configured or hidden:** each provider is enabled only when its client id and secret are both set. `GET /api/auth/methods` returns which providers are enabled, and whether email codes and passkeys are available; the sign-in page builds its buttons from that.
- **Startup rule (replaces Phase 12's):** in production the server refuses to start without `APP_BASE_URL` and at least one enabled sign-in method.
- **Callback, intent `sign-in`:** find the `SignInMethod` by `(kind, subject)`. Found: sign in as its User and refresh `lastUsedAt` and the User's display values. Not found: create a User and its `SignInMethod` in one transaction, then sign in. Either way, run the legacy adoption check (Microsoft personal accounts only, unchanged) and redirect to `/welcome` or `returnTo` as now.
- **Callback, intent `add`:** requires a signed-in session. Found on this User: nothing changes. Found on another User: redirect to `/account/sign-in?error=taken`. Not found: attach to this User. Redirect back to `/account/sign-in`.

### Email codes

- `POST /api/auth/email/start` with `{ email, purpose }`. Always responds `204` with the same timing whether or not the address is on an account, so the endpoint can't be used to find out who has one. For `sign-in`, a code is sent to any valid address. For `add-email` (signed in only), a code is sent unless the address is already on another account, in which case nothing is sent and the later verify returns `taken`.
- **Code:** 6 random digits, valid 10 minutes, only the newest code per address and purpose works, 5 wrong guesses kills it. Only its hash is stored.
- `POST /api/auth/email/verify` with `{ email, code, purpose, returnTo }`:
  - `sign-in`: on success, sign in as the User who has that email as a sign-in method, or create a new User with it. Responds `{ redirectTo }` (`/welcome` or `returnTo`).
  - `add-email`: on success, attach the email to the signed-in User.
  - Wrong or expired code: `400 { error: "That code didn't work. Check it or send a new one." }`.
- **Rate limits** (in memory, enough for one server): at most 3 codes per address per 15 minutes and 10 per IP address per hour. Over the limit still returns `204` but sends nothing.
- **Sending:** generic SMTP through `nodemailer`, configured by `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Email codes are enabled only when all are set. Bob picks the mail service at deploy time. The email is plain text: the code, how long it lasts, and "If you didn't ask for this, ignore it."
- **Tests and E2E** replace the sender with an in-memory outbox they can read.

### Passkeys

- Built on `@simplewebauthn/server` and `@simplewebauthn/browser` (vetted per the dependency-vetting rules before install).
- **Relying party:** id is `APP_BASE_URL`'s hostname (`passport.bobbyjoecool.dev`, or `localhost` locally), name "FamilyPassportMap". Passkeys are only offered when the page is a secure context.
- **Discoverable credentials, user verification preferred**, so sign-in needs no username: the browser offers whichever passkeys it has for this site.
- **Routes:** `POST /api/auth/passkey/register/options` and `/register/verify` (create an account with a new passkey when signed out, or add one when signed in), `POST /api/auth/passkey/signin/options` and `/signin/verify`. Challenges are kept server-side for 5 minutes, tied to a short-lived cookie.
- **Signing up with a passkey** creates a User with no email. `displayName` starts as "New user" until the welcome step sets it from the Primary Person's name.
- `signCount` is checked and stored per the library's rules.

### Managing sign-in methods (API)

- `GET /api/me/sign-in-methods` → `{ methods: [{ id, kind, label, createdAt, lastUsedAt }] }`, where `kind` includes `"passkey"` and `label` is the email or passkey name.
- `DELETE /api/me/sign-in-methods/:id` removes one. Removing the last one returns `409 { error: "This is your only way to sign in, so it can't be removed. Add another first." }`. The count and the delete run in one transaction.
- `PATCH /api/me/passkeys/:id` with `{ name }` renames a passkey (1–40 characters).
- `GET /api/me` gains nothing new; the header keeps using `displayName` and `email` (email may now be null).
- **Delete account** also deletes the User's sign-in methods, passkeys and pending email codes (cascade).

### Web app

- **Sign-in page:** app name; one button per enabled provider ("Continue with Microsoft / Google / GitHub"); "Sign in with a passkey"; a divider; an email field with "Email me a code". After sending, the page shows a 6-digit code field, "Send a new code", and "Use a different email". Messages for `error=cancelled`, `error=failed`, and code errors. The privacy link stays.
- **Account menu** gains **Sign-in methods**, opening `/account/sign-in`.
- **Sign-in methods page:** the list from the API with a remove button on each (disabled with a hint on the last one), a rename action on passkeys, and an "Add" area with the same choices as the sign-in page. `?error=taken` shows "That sign-in already belongs to another account."
- **Welcome step:** the name field is prefilled from the provider when there is one, empty otherwise.
- **Privacy page:** lists what's stored for each kind of sign-in method (provider account id, name and email; passkey public key and name, never a private key; email address), that email codes are sent through the configured mail service, and that removing a method or deleting the account deletes it.

## Move to Voyager

### Decisions

- **One container**, the same single Node process as on Azure: Express serves the API, the photos and the built web app. Folder on the server: `~/apps/familypassportmap`.

  | Service | Container | Port | Networks | Data |
  |---|---|---|---|---|
  | `app` | `familypassportmap-app-1` | 8080 | `web` | `~/apps/familypassportmap/data` → `/app/data` (holds `app.db` and `uploads/`) |

- **No database port:** SQLite stays a file in the data folder.
- **Migrations run on every container start** (`prisma migrate deploy`), as `startup.sh` does on Azure. That's how this phase's `SignInMethod` migration reaches the copied production database.
- **The repo gains `Dockerfile` and `.dockerignore`** (Step 1). The image uses Node 24, the same as CI. Voyager is Intel (amd64) and Bob's laptop (Janeway) is ARM, so images are built with `--platform linux/amd64`.
- **Order:** the code ships to Voyager directly. Azure keeps running the old version until the cutover is verified, then its deploy workflow is disabled, and a week later the Azure resources are deleted.
- **This section replaces `docs/AZURE-SETUP.md` and `docs/Phase-6-Azure-Deployment.md`** as the deployment guide once the move is done. Server details and conventions come from `Voyager_Project_Setup_Guide.md` (Google Drive: Claude Instructions).

### Runbook

**Where each command runs:**

- **[VOYAGER]**: Terminal on Janeway after `ssh voyager` (or `ssh voyager-remote` away from home)
- **[JANEWAY]**: normal Terminal on the M2
- **[BROWSER]**: Azure portal, Microsoft Entra, Google Cloud Console, GitHub, Cloudflare Zero Trust

#### Step 1. Add the Docker build files to the repo (part of this phase's code)

`.dockerignore` at the repo root:
```
**/node_modules
**/dist
**/dist-demo
**/.env
.git
DevNotes
apps/server/data
e2e/test-data
```

`Dockerfile` at the repo root:
```dockerfile
FROM node:24-bookworm-slim
WORKDIR /app
# Set before npm ci, because apps/server's postinstall runs prisma generate
ENV DATA_DIR=/app/data DATABASE_URL=file:/app/data/app.db
COPY . .
RUN npm ci && npm run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "cd apps/server && npx prisma migrate deploy && cd /app && exec node apps/server/dist/index.js"]
```
`npm ci` creates the `@familypassportmap/shared` workspace link itself, so the symlink step from `startup.sh` isn't needed. `better-sqlite3` and `sharp` are compiled or downloaded for Linux amd64 during the build. Before deploying, Claude builds the image locally and runs it against a throwaway data folder to check that migrations apply and the app serves.

#### Step 2. Build the image and send it to the server

**[JANEWAY]**
```bash
cd ~/csd/Side-Projects/FamilyPassportMap
docker buildx build --platform linux/amd64 -t familypassportmap:latest --load .
docker save familypassportmap:latest | ssh voyager docker load
```

#### Step 3. Copy the live data and settings from Azure

Do this right before cutover. Avoid adding people or photos on the Azure site between now and Step 8, or those changes won't come across.

**[BROWSER]**

1. While signed in to the Azure portal, open:
   `https://family-passport-map.scm.azurewebsites.net/api/zip/data/`
   This downloads a zip of `/home/data` (the SQLite database and the `uploads` folder).
2. Azure portal → App Service `family-passport-map` → **Environment variables**. Copy the values of `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` and `LEGACY_DATA_OWNER_EMAIL`. Keep them out of chat and git.

**[JANEWAY]**
```bash
mkdir -p ~/fpm-data && cd ~/fpm-data
unzip ~/Downloads/data.zip     # adjust the file name if the browser renamed it
ls                            # expect app.db and uploads/
ssh voyager mkdir -p apps/familypassportmap/data
rsync -av ~/fpm-data/ voyager:apps/familypassportmap/data/
```

#### Step 4. Register the sign-in providers' production callbacks

**[BROWSER]**

1. **Microsoft** (Entra admin center → App registrations → the FamilyPassportMap app):
   - **Authentication → Web → Add URI:** `https://passport.bobbyjoecool.dev/api/auth/microsoft/callback` → Save. Leave the localhost URI for development, and leave the Azure URI until the old app is deleted.
   - **Branding & properties:** home page `https://passport.bobbyjoecool.dev`, privacy statement `https://passport.bobbyjoecool.dev/privacy` → Save.
2. **Google** (Google Cloud Console → APIs & Services → Credentials → the Web application OAuth client): add the authorized redirect URI `https://passport.bobbyjoecool.dev/api/auth/google/callback`. Copy the client id and secret.
3. **GitHub** (Settings → Developer settings → OAuth Apps): the **production** OAuth app's callback is `https://passport.bobbyjoecool.dev/api/auth/github/callback` (GitHub allows one callback per app, so local development uses a second app). Copy its client id and a new client secret.
4. **Mail service:** have the SMTP host, port, user, password and the `MAIL_FROM` address ready.

#### Step 5. Create the settings file and compose file, and start the app

**[VOYAGER]** Replace each `PASTE_…` value. A provider left blank is simply hidden on the sign-in page; email codes need all five mail settings.
```bash
cd ~/apps/familypassportmap
umask 077
cat > .env <<'EOF'
APP_BASE_URL=https://passport.bobbyjoecool.dev
LEGACY_DATA_OWNER_EMAIL=PASTE_FROM_AZURE
MICROSOFT_CLIENT_ID=PASTE_FROM_AZURE
MICROSOFT_CLIENT_SECRET=PASTE_FROM_AZURE
GOOGLE_CLIENT_ID=PASTE_FROM_GOOGLE
GOOGLE_CLIENT_SECRET=PASTE_FROM_GOOGLE
GITHUB_CLIENT_ID=PASTE_FROM_GITHUB
GITHUB_CLIENT_SECRET=PASTE_FROM_GITHUB
SMTP_HOST=PASTE_FROM_MAIL_SERVICE
SMTP_PORT=PASTE_FROM_MAIL_SERVICE
SMTP_USER=PASTE_FROM_MAIL_SERVICE
SMTP_PASSWORD=PASTE_FROM_MAIL_SERVICE
MAIL_FROM=PASTE_ADDRESS
EOF

cat > compose.yaml <<'EOF'
services:
  app:
    image: familypassportmap:latest
    restart: unless-stopped
    networks: [web]
    env_file: .env
    volumes:
      - ./data:/app/data
networks:
  web:
    external: true
EOF

docker compose up -d
docker compose logs --tail 30
```
**Success:** the log shows Prisma migrations applied (including this phase's sign-in methods migration) and `FamilyPassportMap server listening on http://localhost:8080`. If it exits complaining about missing settings, `APP_BASE_URL` is empty or no sign-in method is fully configured.

Test from inside the server:
```bash
docker run --rm --network web curlimages/curl -s -o /dev/null -w "%{http_code}\n" http://familypassportmap-app-1:8080/
```
Expect `200`.

#### Step 6. Publish it through the tunnel

**[BROWSER]** Cloudflare Zero Trust → Networks → Tunnels → `voyager` → **Published application routes** → Add:

| Field | Value |
|---|---|
| Subdomain | `passport` |
| Domain | `bobbyjoecool.dev` |
| Type | HTTP |
| URL | `familypassportmap-app-1:8080` |

#### Step 7. Verify on production

Open `https://passport.bobbyjoecool.dev`:

1. Sign in with Microsoft. People, US and World (Map / Compare / List) show the existing data and photos, and Sign-in methods lists Microsoft.
2. Add Google, GitHub, a passkey and an email to that account; sign out; sign back in with each.
3. Passkeys made on `localhost` during development don't carry over; make a new one here.

#### Step 8. Stop Azure deploys

**[JANEWAY]**
```bash
cd ~/csd/Side-Projects/FamilyPassportMap
gh workflow disable "Deploy to Azure"
```

#### Step 9. Back up the data folder

SQLite and photos are not covered by `~/backup.sh` automatically.

**[VOYAGER]** Edit `~/backup.sh` and add this before the `find` cleanup line:
```bash
tar -czf "$BACKUP_DIR/familypassportmap-files-$(date +%F).tar.gz" -C /home/bobbyjoecool/apps/familypassportmap data
```
If you haven't already, change the cleanup line's `-name '*.dump'` to `\( -name '*.dump' -o -name '*.sql.gz' -o -name '*.tar.gz' \)`. Test:
```bash
~/backup.sh && ls -lh ~/backups
```

#### Step 10. Bookkeeping

1. Add this row to the registry (section 5 of the Voyager setup guide):

   | App folder | Public hostname | Container:port | DB local port |
   |---|---|---|---|
   | `familypassportmap` | `passport.bobbyjoecool.dev` | `familypassportmap-app-1:8080` | none (SQLite in `./data`) |

2. Update the README's live link and hosting section.
3. **After a week of it working** **[JANEWAY]**:
   ```bash
   az group delete -n family_passport_app_rg
   ```
   Then remove the Azure redirect URI from the Entra app registration. **Keep the app registration itself**, because sign-in depends on it. Then delete `.github/workflows/azure-deploy.yml`, `deploy.sh`, `startup.sh` and `docs/AZURE-SETUP.md`.

### Updating after code changes

**[JANEWAY]**
```bash
cd ~/csd/Side-Projects/FamilyPassportMap
docker buildx build --platform linux/amd64 -t familypassportmap:latest --load .
docker save familypassportmap:latest | ssh voyager docker load
```
**[VOYAGER]**
```bash
cd ~/apps/familypassportmap && docker compose up -d --force-recreate app
```
New Prisma migrations apply automatically when the container starts.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| A provider's sign-in error about the redirect URI | Its registered callback must match `APP_BASE_URL` + `/api/auth/<provider>/callback` exactly. |
| A provider's button is missing | Its client id or secret is empty in `.env`. |
| Passkey button missing or failing | The page must be the `https://` address; passkeys are tied to `passport.bobbyjoecool.dev`. |
| Signed in, but bounced back to the sign-in page | Cookies are `secure` in production, so you must use the `https://` address, not a LAN `http://` address. |
| People show but photos are broken | `uploads/` didn't land inside `~/apps/familypassportmap/data/`. Check with `ls ~/apps/familypassportmap/data`. |
| `exec format error` | The image was built for ARM. Rebuild with `--platform linux/amd64`. |
| Container keeps restarting | `cd ~/apps/familypassportmap && docker compose logs --tail 50 app` |
| Cloudflare 502 / 1033 | The route must be exactly `familypassportmap-app-1:8080`. Check `cd ~/apps/tunnel && docker compose logs --tail 30`. |

## Testing Decisions

- **Seams:** the HTTP API through Supertest stays the main one. The fakes are the three provider adapters, the mail sender (in-memory outbox) and, for passkeys, a test helper that produces valid WebAuthn responses from a software key pair.
- **Server tests cover:**
  - Each provider: new subject creates a User; same subject signs the same User in; two providers with the same email are two Users.
  - Disabled providers: their start route is `404`, and they're missing from `GET /api/auth/methods`.
  - Add flow: attach to self; already on self is a no-op; on another User gives `taken` and changes nothing; signed out is refused.
  - Email: unknown address creates a User; known address signs in; wrong code, expired code, reused code, 6th guess, rate limits; `start` responds the same for known and unknown addresses; `add-email` for an address on another account.
  - Passkeys: sign-up, sign-in, add while signed in, unknown credential refused, sign-count regression refused.
  - Removing methods: allowed while others remain, refused for the last one; removing another User's method is `404`.
  - Migration: an existing Microsoft User still signs in after it and has one `SignInMethod`.
  - Delete account removes methods, passkeys and codes.
  - Legacy adoption still works through Microsoft, and never through other methods.
- **Web unit tests** for the sign-in page (buttons follow `GET /api/auth/methods`, the email code steps) and the Sign-in methods page.
- **Docker image:** Claude builds the image locally and runs it against a throwaway data folder (a copy of a test database with a Microsoft User from before this phase): the container applies the migrations, serves `/` and `/api/health`, and refuses to start with no sign-in method configured.
- **E2E (Playwright):** the fake sign-in page gains a provider choice; email codes are read from the test outbox; passkeys use Chrome's virtual authenticator. One spec per flow: sign up and sign in with each method, add and remove methods, the last-method guard, and `taken`.

## Out of Scope

- Sign in with Apple (needs a paid Apple Developer membership). The adapter design leaves room to add it later as a code-only change plus keys.
- Merging two existing accounts.
- Passwords.
- Magic links (codes only).
- Recovery codes or admin-assisted recovery. A User who loses every sign-in method loses the account; the Sign-in methods page encourages adding a second one.
- Changing the access policy, Link or Join.
- Moving the guest demo off GitHub Pages.
- Running the app on any host other than Voyager (Azure is retired after the move).

## Acceptance criteria

- `npm test` and `npm run test:e2e` pass locally, and `npm run build` passes.
- **Manual local checklist** (dev servers running, real Google and GitHub OAuth apps registered for `http://localhost:5173`, a real SMTP account):
  1. With only Google configured, the sign-in page shows only Google, passkey (localhost is a secure context) and email when SMTP is set.
  2. New accounts can be created with each of Microsoft, Google, GitHub, a passkey and an email code, each landing on the welcome step.
  3. The existing Microsoft account (copied from production data) still signs in and shows Microsoft as its one method.
  4. From one account, add Google, a passkey and an email; sign out; sign back in with each; it's the same account every time.
  5. Adding a Google account that belongs to another User shows the "already belongs" message.
  6. Removing methods down to one works; the last one can't be removed.
  7. The code email arrives, a wrong code is refused, and an expired code is refused.
  8. Delete account, then sign in with any of its old methods: a fresh account starts.
- The Docker image builds and runs locally as described under Testing Decisions.
- **Voyager cutover** (Bob, following the runbook above): the app is live at `https://passport.bobbyjoecool.dev` with the production data and photos, every configured sign-in method works there (runbook Step 7), Azure deploys are disabled, and the data folder is in the nightly backup.
- ERD matches the schema. `CONTEXT.md` has the new terms. README (live link and hosting) and the privacy page describe the new sign-in methods and hosting.
- `PHASES.md` marks the phase complete; `CHANGELOG.md` gets a v2.5.0 entry.

## Decisions to carry forward

- **A sign-in method belongs to exactly one User**, enforced by the unique `(kind, subject)`. Accounts are never merged automatically; any future merge feature is its own phase.
- **Adding a provider is a new adapter module plus settings.** Apple would be the next one.
- **`User.email` can be null.** Anything that wants to contact a User must handle that.
- **The guest demo (Phase 14) never talks to the server**, so none of this needs a demo mode on the server side. New `/api` routes still need a fake-API handler and a contract scenario (Phase 14's rule), or the demo shows them as "Not available in the demo."
- **Production is Voyager.** Deploys are a Docker image build plus a container restart ("Updating after code changes"). Nothing deploys on push to `main` any more except the guest demo to GitHub Pages.

## Further Notes

- **Settings on Voyager** (`.env`, runbook Step 5): `APP_BASE_URL`, `LEGACY_DATA_OWNER_EMAIL`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
- **Bob registers** (not Claude): a Google OAuth client (Google Cloud Console, Web application) and a GitHub OAuth app, each with callbacks `http://localhost:5173/api/auth/<provider>/callback` and `https://passport.bobbyjoecool.dev/api/auth/<provider>/callback`. GitHub OAuth apps allow one callback URL each, so local and production need two GitHub apps.
- **Passkeys are tied to the domain.** Passkeys made on `localhost` don't work on `passport.bobbyjoecool.dev`, and vice versa. That's why the move to Voyager is part of this phase instead of deploying to Azure first.

## Open questions

1. **Where should email codes come from?** `MAIL_FROM` could be `bob@bobbyjoecool.dev` or something like `no-reply@bobbyjoecool.dev`. This only matters at deploy time.
2. **Should the header show a provider's profile picture** (Google and GitHub send one) instead of the initial? Phase 12 kept the column for this.
