-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "autoClose" BOOLEAN NOT NULL DEFAULT false,
    "allowPause" BOOLEAN NOT NULL DEFAULT false,
    "allowRenew" BOOLEAN NOT NULL DEFAULT false,
    "allowEarlyClose" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);
INSERT INTO "new_Plan" ("allowEarlyClose", "allowPause", "allowRenew", "autoClose", "billingPeriod", "endDate", "id", "minQuantity", "name", "price", "startDate") SELECT "allowEarlyClose", "allowPause", "allowRenew", "autoClose", "billingPeriod", "endDate", "id", "minQuantity", "name", "price", "startDate" FROM "Plan";
DROP TABLE "Plan";
ALTER TABLE "new_Plan" RENAME TO "Plan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
