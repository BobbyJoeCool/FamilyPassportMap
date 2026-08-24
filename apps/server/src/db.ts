import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
// Fail fast at startup rather than surfacing a confusing error the first time a route
// tries to query the database.
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set (check apps/server/.env)");
}

// Prisma 7 requires an explicit driver adapter to connect — see Documentation/Phase-1-Data-Layer-People.md.
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

export const prisma = new PrismaClient({ adapter });
