-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Language" ADD VALUE 'GERMAN';
ALTER TYPE "Language" ADD VALUE 'PORTUGUESE';
ALTER TYPE "Language" ADD VALUE 'ITALIAN';
ALTER TYPE "Language" ADD VALUE 'CHINESE';
ALTER TYPE "Language" ADD VALUE 'JAPANESE';
ALTER TYPE "Language" ADD VALUE 'KOREAN';
ALTER TYPE "Language" ADD VALUE 'ARABIC';
ALTER TYPE "Language" ADD VALUE 'HINDI';
ALTER TYPE "Language" ADD VALUE 'RUSSIAN';
ALTER TYPE "Language" ADD VALUE 'DUTCH';
ALTER TYPE "Language" ADD VALUE 'POLISH';
ALTER TYPE "Language" ADD VALUE 'TURKISH';
ALTER TYPE "Language" ADD VALUE 'VIETNAMESE';
ALTER TYPE "Language" ADD VALUE 'THAI';
ALTER TYPE "Language" ADD VALUE 'INDONESIAN';
ALTER TYPE "Language" ADD VALUE 'MALAY';
ALTER TYPE "Language" ADD VALUE 'FILIPINO';

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "sharedWithUserIds" TEXT[];
