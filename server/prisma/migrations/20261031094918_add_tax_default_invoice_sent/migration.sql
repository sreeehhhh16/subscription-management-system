-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "sentAt" DATETIME;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "discountId" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "quotationExpiresAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SubscriptionLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subscriptionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "taxId" INTEGER,
    "amount" REAL NOT NULL,
    CONSTRAINT "SubscriptionLine_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionLine_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SubscriptionLine" ("amount", "id", "productId", "quantity", "subscriptionId", "taxId", "unitPrice") SELECT "amount", "id", "productId", "quantity", "subscriptionId", "taxId", "unitPrice" FROM "SubscriptionLine";
DROP TABLE "SubscriptionLine";
ALTER TABLE "new_SubscriptionLine" RENAME TO "SubscriptionLine";
CREATE TABLE "new_Tax" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ratePct" REAL NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Tax" ("id", "name", "ratePct") SELECT "id", "name", "ratePct" FROM "Tax";
DROP TABLE "Tax";
ALTER TABLE "new_Tax" RENAME TO "Tax";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_status_nextBillingDate_idx" ON "Subscription"("status", "nextBillingDate");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
