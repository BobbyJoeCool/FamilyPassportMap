# Moving FamilyPassportMap from Azure to Voyager

How to move the app from Azure App Service (F1) to Voyager (the 2011 MacBook Pro home server) at `https://passport.bobbyjoecool.dev`, keeping the existing SQLite database, uploaded photos, and Microsoft sign-in.

> **Update before running this:** Phase 13 (`docs/Phase-13-Sign-In-Methods.md`) ships with this move. Steps 4 and 5 still describe Microsoft-only sign-in; they get Google, GitHub and SMTP settings and callback registrations once Phase 13 is built.

This replaces `AZURE-SETUP.md` / `Phase-6-Azure-Deployment.md` once the move is done. Server details and conventions come from `Voyager_Project_Setup_Guide.md` (Google Drive: Claude Instructions).

**Where each command runs:**

- **[VOYAGER]**: Terminal on Janeway after `ssh voyager` (or `ssh voyager-remote` away from home)
- **[JANEWAY]**: normal Terminal on the M2
- **[BROWSER]**: Azure portal, Microsoft Entra, Cloudflare Zero Trust

---

## What gets deployed

Folder on the server: `~/apps/familypassportmap`

| Service | Container | Port | Networks | Data |
|---|---|---|---|---|
| `app` | `familypassportmap-app-1` | 8080 | `web` | `~/apps/familypassportmap/data` → `/app/data` (holds `app.db` and `uploads/`) |

It's the same single Node process as on Azure: Express serves the API, the photos, and the built web app. `prisma migrate deploy` runs on every container start, the same as `startup.sh` does on Azure. There's no database port, because SQLite is a file in the data folder.

---

## Step 1. Add the Docker build files to the repo

**[JANEWAY]** Create `.dockerignore` at the repo root:
```
**/node_modules
**/dist
**/.env
.git
DevNotes
apps/server/data
```

Create `Dockerfile` at the repo root:
```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app
# Set before npm ci, because apps/server's postinstall runs prisma generate
ENV DATA_DIR=/app/data DATABASE_URL=file:/app/data/app.db
COPY . .
RUN npm ci && npm run build
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "cd apps/server && npx prisma migrate deploy && cd /app && exec node apps/server/dist/index.js"]
```
`npm ci` creates the `@familypassportmap/shared` workspace link itself, so the symlink step from `startup.sh` isn't needed. `better-sqlite3` is compiled or downloaded for Linux amd64 during the build.

## Step 2. Build the image and send it to the server

Voyager is Intel (amd64) and Janeway is ARM, so build with `--platform linux/amd64`.

**[JANEWAY]**
```bash
cd ~/csd/Side-Projects/FamilyPassportMap
docker buildx build --platform linux/amd64 -t familypassportmap:latest --load .
docker save familypassportmap:latest | ssh voyager docker load
```

## Step 3. Copy the live data and settings from Azure

Do this right before cutover. Avoid adding people or photos on the Azure site between now and step 7, or those changes won't come across.

**[BROWSER]**

1. While signed in to the Azure portal, open:
   `https://family-passport-map.scm.azurewebsites.net/api/zip/data/`
   This downloads a zip of `/home/data` (the SQLite database and the `uploads` folder).
2. Azure portal → App Service `family-passport-map` → **Environment variables**. Copy the values of `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`. Keep them out of chat and git.

**[JANEWAY]**
```bash
mkdir -p ~/fpm-data && cd ~/fpm-data
unzip ~/Downloads/data.zip     # adjust the file name if the browser renamed it
ls                            # expect app.db and uploads/
ssh voyager mkdir -p apps/familypassportmap/data
rsync -av ~/fpm-data/ voyager:apps/familypassportmap/data/
```

## Step 4. Create the settings file and compose file, and start the app

**[VOYAGER]** Replace the two `PASTE_FROM_AZURE` values:
```bash
cd ~/apps/familypassportmap
umask 077
cat > .env <<'EOF'
MICROSOFT_CLIENT_ID=PASTE_FROM_AZURE
MICROSOFT_CLIENT_SECRET=PASTE_FROM_AZURE
APP_BASE_URL=https://passport.bobbyjoecool.dev
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
**Success:** the log shows Prisma migrations applied (or "No pending migrations") and `FamilyPassportMap server listening on http://localhost:8080`. If it exits complaining about missing settings, a value in `.env` is empty.

Test from inside the server:
```bash
docker run --rm --network web curlimages/curl -s -o /dev/null -w "%{http_code}\n" http://familypassportmap-app-1:8080/
```
Expect `200`.

## Step 5. Update Microsoft sign-in

**[BROWSER]** Microsoft Entra admin center → App registrations → the FamilyPassportMap app:

1. **Authentication → Web → Add URI:** `https://passport.bobbyjoecool.dev/api/auth/microsoft/callback` → Save. Leave the localhost URI for development, and leave the Azure URI until the old app is deleted.
2. **Branding & properties:** home page `https://passport.bobbyjoecool.dev`, privacy statement `https://passport.bobbyjoecool.dev/privacy` → Save.

## Step 6. Publish it through the tunnel

**[BROWSER]** Cloudflare Zero Trust → Networks → Tunnels → `voyager` → **Published application routes** → Add:

| Field | Value |
|---|---|
| Subdomain | `passport` |
| Domain | `bobbyjoecool.dev` |
| Type | HTTP |
| URL | `familypassportmap-app-1:8080` |

## Step 7. Verify, then stop Azure deploys

Open `https://passport.bobbyjoecool.dev`, sign in with Microsoft, and check that People, the US section, and the World section (Map / Compare / List) all show your existing data and photos.

**[JANEWAY]** Stop GitHub from deploying to Azure on every push:
```bash
cd ~/csd/Side-Projects/FamilyPassportMap
gh workflow disable "Deploy to Azure"
```

## Step 8. Back up the data folder

SQLite and photos are not covered by `~/backup.sh` automatically.

**[VOYAGER]** Edit `~/backup.sh` and add this before the `find` cleanup line:
```bash
tar -czf "$BACKUP_DIR/familypassportmap-files-$(date +%F).tar.gz" -C /home/bobbyjoecool/apps/familypassportmap data
```
If you haven't already, change the cleanup line's `-name '*.dump'` to `\( -name '*.dump' -o -name '*.sql.gz' -o -name '*.tar.gz' \)`. Test:
```bash
~/backup.sh && ls -lh ~/backups
```

## Step 9. Bookkeeping

1. Add this row to the registry (section 5 of the Voyager setup guide):

   | App folder | Public hostname | Container:port | DB local port |
   |---|---|---|---|
   | `familypassportmap` | `passport.bobbyjoecool.dev` | `familypassportmap-app-1:8080` | none (SQLite in `./data`) |

2. Update the README's live link and hosting section.
3. **After a week of it working** **[JANEWAY]**:
   ```bash
   az group delete -n family_passport_app_rg
   ```
   Then remove the Azure redirect URI from the Entra app registration. **Keep the app registration itself**, because sign-in depends on it. You can also delete `.github/workflows/azure-deploy.yml` and `deploy.sh`.

---

## Updating after code changes

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

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Microsoft sign-in error about the redirect URI | The callback URI in Entra must match `APP_BASE_URL` + `/api/auth/microsoft/callback` exactly. |
| Signed in, but bounced back to the sign-in page | Cookies are `secure` in production, so you must use the `https://` address, not a LAN `http://` address. |
| People show but photos are broken | `uploads/` didn't land inside `~/apps/familypassportmap/data/`. Check with `ls ~/apps/familypassportmap/data`. |
| `exec format error` | The image was built for ARM. Rebuild with `--platform linux/amd64`. |
| Container keeps restarting | `cd ~/apps/familypassportmap && docker compose logs --tail 50 app` |
| Cloudflare 502 / 1033 | The route must be exactly `familypassportmap-app-1:8080`. Check `cd ~/apps/tunnel && docker compose logs --tail 30`. |
