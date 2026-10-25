-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authProvider" TEXT NOT NULL,
    "authSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "primaryPersonId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_primaryPersonId_fkey" FOREIGN KEY ("primaryPersonId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("authProvider", "authSubject", "avatarUrl", "createdAt", "displayName", "email", "id") SELECT "authProvider", "authSubject", "avatarUrl", "createdAt", "displayName", "email", "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_primaryPersonId_key" ON "User"("primaryPersonId");
CREATE UNIQUE INDEX "User_authProvider_authSubject_key" ON "User"("authProvider", "authSubject");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
