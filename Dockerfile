# FamilyPassportMap's production image for Voyager (docs/Phase-13-Sign-In-Methods.md, "Move to
# Voyager"). One container runs one Node process: Express serves the API, the photos and the built
# web app on port 8080. The SQLite database and uploaded photos live in /app/data, which compose.yaml
# mounts from the server's disk so they survive rebuilds.
#
# Two stages: "build" has the C/C++ toolchain that native modules (better-sqlite3) need when no
# prebuilt binary matches, installs everything and builds; the final image copies only the result,
# so compilers never ship to production.

# ---- Stage 1: install and build ----
# Node 24 on Debian (bookworm), the "slim" variant: small, but with the glibc the native modules
# need. Same Node major as CI.
FROM node:24-bookworm-slim AS build
# python3, make and g++: what node-gyp needs to compile a native module from source.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Set before npm ci, because apps/server's postinstall runs `prisma generate`, which reads them.
ENV DATA_DIR=/app/data DATABASE_URL=file:/app/data/app.db
# The whole repo (minus .dockerignore), then a clean install from package-lock.json and a full
# build: shared package, server (TypeScript to dist) and web app (Vite to apps/web/dist).
COPY . .
RUN npm ci && npm run build

# ---- Stage 2: the image that runs ----
FROM node:24-bookworm-slim
# openssl: Prisma's migration engine links against it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV DATA_DIR=/app/data DATABASE_URL=file:/app/data/app.db NODE_ENV=production PORT=8080
# npx (used for the migration step) shouldn't print "new npm version" notices into the logs.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY --from=build /app /app
EXPOSE 8080
# On every start: apply any new database migrations, then run the server. `exec` makes Node the
# container's main process, so `docker compose stop` reaches it directly and it shuts down cleanly.
CMD ["sh", "-c", "cd apps/server && npx prisma migrate deploy && cd /app && exec node apps/server/dist/index.js"]
