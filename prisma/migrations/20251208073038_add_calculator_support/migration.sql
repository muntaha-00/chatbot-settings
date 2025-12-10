-- AlterTable
ALTER TABLE "Form" ADD COLUMN "calculatorSettings" TEXT;

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "FormSubmission" ADD COLUMN "customerName" TEXT;
ALTER TABLE "FormSubmission" ADD COLUMN "orderNumber" TEXT;

-- CreateTable
CREATE TABLE "CalculatorResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "inputValues" TEXT NOT NULL,
    "calculatedResults" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "customerId" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalculatorResult_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "formIds" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CalculatorAnalytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT,
    "sessionId" TEXT,
    "customerId" TEXT,
    "productId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FormField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT,
    "metadata" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "calculatorValue" TEXT,
    "isQuantity" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FormField" ("createdAt", "formId", "id", "label", "metadata", "options", "order", "placeholder", "required", "type", "updatedAt") SELECT "createdAt", "formId", "id", "label", "metadata", "options", "order", "placeholder", "required", "type", "updatedAt" FROM "FormField";
DROP TABLE "FormField";
ALTER TABLE "new_FormField" RENAME TO "FormField";
CREATE INDEX "FormField_formId_idx" ON "FormField"("formId");
CREATE INDEX "FormField_formId_order_idx" ON "FormField"("formId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CalculatorResult_formId_idx" ON "CalculatorResult"("formId");

-- CreateIndex
CREATE INDEX "CalculatorResult_shop_createdAt_idx" ON "CalculatorResult"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "CalculatorResult_productId_idx" ON "CalculatorResult"("productId");

-- CreateIndex
CREATE INDEX "PricingRule_shop_idx" ON "PricingRule"("shop");

-- CreateIndex
CREATE INDEX "PricingRule_shop_isActive_idx" ON "PricingRule"("shop", "isActive");

-- CreateIndex
CREATE INDEX "CalculatorAnalytics_shop_formId_createdAt_idx" ON "CalculatorAnalytics"("shop", "formId", "createdAt");

-- CreateIndex
CREATE INDEX "CalculatorAnalytics_eventType_idx" ON "CalculatorAnalytics"("eventType");

-- CreateIndex
CREATE INDEX "FormSubmission_orderNumber_idx" ON "FormSubmission"("orderNumber");
