-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "collectionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extinctionStatus" TEXT,
ADD COLUMN     "lastCollected" TIMESTAMP(3);
