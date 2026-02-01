/*
  Warnings:

  - You are about to drop the column `light` on the `Plant` table. All the data in the column will be lost.
  - You are about to drop the column `species` on the `Plant` table. All the data in the column will be lost.
  - You are about to drop the column `water` on the `Plant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plant" DROP COLUMN "light",
DROP COLUMN "species",
DROP COLUMN "water",
ADD COLUMN     "avsaRegistrationNum" TEXT,
ADD COLUMN     "blossom" TEXT,
ADD COLUMN     "foliage" TEXT,
ADD COLUMN     "hybridizer" TEXT,
ADD COLUMN     "registrationDate" TEXT,
ADD COLUMN     "type" TEXT;
