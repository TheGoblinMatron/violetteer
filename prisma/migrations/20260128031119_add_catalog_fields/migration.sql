-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "contributionStatus" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "isInCatalog" BOOLEAN NOT NULL DEFAULT false;
