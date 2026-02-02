-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAvsaMember" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "localClub" TEXT,
ADD COLUMN     "otherAffiliation" TEXT;
