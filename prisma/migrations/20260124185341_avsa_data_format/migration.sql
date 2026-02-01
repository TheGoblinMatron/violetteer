/*
  Warnings:

  - You are about to drop the column `avsaRegistrationNum` on the `Plant` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Plant` table. All the data in the column will be lost.
  - You are about to drop the column `registrationDate` on the `Plant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plant" DROP COLUMN "avsaRegistrationNum",
DROP COLUMN "notes",
DROP COLUMN "registrationDate",
ADD COLUMN     "alias" TEXT,
ADD COLUMN     "altReg" TEXT,
ADD COLUMN     "engTrans" TEXT,
ADD COLUMN     "lineage" TEXT,
ADD COLUMN     "recNum" INTEGER,
ADD COLUMN     "regDate" TEXT,
ADD COLUMN     "regNum" TEXT,
ADD COLUMN     "vintage" TEXT;
