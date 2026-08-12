// Prisma 7 config file — the CLI (generate/migrate) reads DATABASE_URL from here,
// not from schema.prisma. .env is NOT auto-loaded by Prisma, hence the explicit import.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
