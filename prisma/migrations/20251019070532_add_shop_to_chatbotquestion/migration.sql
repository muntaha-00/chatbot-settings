/*
  Warnings:

  - Added the required column `shop` to the `ChatbotQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatbotQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ChatbotQuestion" ("createdAt", "id", "question", "shop") SELECT "createdAt", "id", "question", 'default-shop' FROM "ChatbotQuestion";
DROP TABLE "ChatbotQuestion";
ALTER TABLE "new_ChatbotQuestion" RENAME TO "ChatbotQuestion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
