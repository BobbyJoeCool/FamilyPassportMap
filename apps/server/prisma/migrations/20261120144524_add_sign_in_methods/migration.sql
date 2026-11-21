-- Phase 13: Sign-in methods. Every existing User's one sign-in (User.authProvider/authSubject,
-- always Microsoft) is copied into a SignInMethod row BEFORE those columns are dropped, so existing
-- Microsoft sign-ins keep working with no action from anyone. Hand-edited: the "Copy existing
-- sign-ins" statement below is the only addition to what Prisma generated.
-- CreateTable
CREATE TABLE "SignInMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignInMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy existing sign-ins. The id is a random cuid-like text value ('c' + 24 hex digits), since
-- SQL can't call cuid(); ids are opaque strings everywhere they're used. Dates reuse the User's
-- own createdAt so they're stored in exactly the format Prisma wrote.
INSERT INTO "SignInMethod" ("id", "userId", "kind", "subject", "email", "createdAt", "lastUsedAt")
SELECT 'c' || lower(hex(randomblob(12))), "id", "authProvider", "authSubject", "email", "createdAt", "createdAt" FROM "User";

-- CreateTable
CREATE TABLE "Passkey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BLOB NOT NULL,
    "signCount" INTEGER NOT NULL,
    "transports" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "primaryPersonId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_primaryPersonId_fkey" FOREIGN KEY ("primaryPersonId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "displayName", "email", "id", "primaryPersonId") SELECT "avatarUrl", "createdAt", "displayName", "email", "id", "primaryPersonId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_primaryPersonId_key" ON "User"("primaryPersonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SignInMethod_userId_idx" ON "SignInMethod"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SignInMethod_kind_subject_key" ON "SignInMethod"("kind", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE INDEX "Passkey_userId_idx" ON "Passkey"("userId");
