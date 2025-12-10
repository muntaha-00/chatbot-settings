-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateName" TEXT,
    "templateDescription" TEXT,
    "formulaSettings" TEXT,
    "productSettings" TEXT,
    "nonProductSettings" TEXT,
    "advancedSettings" TEXT,
    "calculatorSettings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Form" ("advancedSettings", "calculatorSettings", "createdAt", "description", "formulaSettings", "id", "isActive", "name", "nonProductSettings", "productSettings", "shop", "updatedAt") SELECT "advancedSettings", "calculatorSettings", "createdAt", "description", "formulaSettings", "id", "isActive", "name", "nonProductSettings", "productSettings", "shop", "updatedAt" FROM "Form";
DROP TABLE "Form";
ALTER TABLE "new_Form" RENAME TO "Form";
CREATE INDEX "Form_shop_idx" ON "Form"("shop");
CREATE INDEX "Form_shop_isActive_idx" ON "Form"("shop", "isActive");
CREATE INDEX "Form_isTemplate_idx" ON "Form"("isTemplate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
