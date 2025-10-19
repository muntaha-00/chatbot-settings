/*
  Warnings:

  - You are about to drop the `ChatbotSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChatbotSettings";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "chatbotSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "botName" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'openai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
