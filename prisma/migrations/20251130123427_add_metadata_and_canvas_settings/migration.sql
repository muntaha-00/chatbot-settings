-- AlterTable
ALTER TABLE "Form" ADD COLUMN "advancedSettings" TEXT;
ALTER TABLE "Form" ADD COLUMN "formulaSettings" TEXT;
ALTER TABLE "Form" ADD COLUMN "nonProductSettings" TEXT;
ALTER TABLE "Form" ADD COLUMN "productSettings" TEXT;

-- AlterTable
ALTER TABLE "FormField" ADD COLUMN "metadata" TEXT;
