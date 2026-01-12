/*
  Warnings:

  - The values [ACCESS_ISSUE,BILLING] on the enum `SupportCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [NEW] on the enum `SupportRequestStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `regulatoryTags` column on the `CAPAction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `subject` to the `SupportRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SupportCategory_new" AS ENUM ('GENERAL_INQUIRY', 'TECHNICAL_ISSUE', 'BILLING_QUESTION', 'FEATURE_REQUEST', 'BUG_REPORT', 'ACCOUNT_ASSISTANCE', 'OTHER');
ALTER TABLE "SupportRequest" ALTER COLUMN "category" TYPE "SupportCategory_new" USING ("category"::text::"SupportCategory_new");
ALTER TYPE "SupportCategory" RENAME TO "SupportCategory_old";
ALTER TYPE "SupportCategory_new" RENAME TO "SupportCategory";
DROP TYPE "SupportCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SupportRequestStatus_new" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
ALTER TABLE "SupportRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SupportRequest" ALTER COLUMN "status" TYPE "SupportRequestStatus_new" USING ("status"::text::"SupportRequestStatus_new");
ALTER TYPE "SupportRequestStatus" RENAME TO "SupportRequestStatus_old";
ALTER TYPE "SupportRequestStatus_new" RENAME TO "SupportRequestStatus";
DROP TYPE "SupportRequestStatus_old";
ALTER TABLE "SupportRequest" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable
ALTER TABLE "CAPAction" DROP COLUMN "regulatoryTags",
ADD COLUMN     "regulatoryTags" TEXT[];

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "subject" TEXT NOT NULL,
ADD COLUMN     "submittedByUserEmail" TEXT,
ALTER COLUMN "submittedByUserId" DROP NOT NULL,
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'OPEN';
