/*
  Warnings:

  - You are about to drop the column `type` on the `Plant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plant" DROP COLUMN "type",
ADD COLUMN     "habit" TEXT;
