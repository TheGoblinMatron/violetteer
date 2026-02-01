/*
  Warnings:

  - You are about to drop the `OwnedPlant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishlistPlant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OwnedPlant" DROP CONSTRAINT "OwnedPlant_plantId_fkey";

-- DropForeignKey
ALTER TABLE "WishlistPlant" DROP CONSTRAINT "WishlistPlant_plantId_fkey";

-- DropTable
DROP TABLE "OwnedPlant";

-- DropTable
DROP TABLE "WishlistPlant";

-- CreateTable
CREATE TABLE "List" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListPlant" (
    "id" SERIAL NOT NULL,
    "listId" INTEGER NOT NULL,
    "plantId" INTEGER NOT NULL,
    "notes" TEXT,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListPlant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantPhoto" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER NOT NULL,
    "userId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "rating" INTEGER,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "List_userId_name_key" ON "List"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ListPlant_listId_plantId_key" ON "ListPlant"("listId", "plantId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_plantId_userId_key" ON "Review"("plantId", "userId");

-- AddForeignKey
ALTER TABLE "ListPlant" ADD CONSTRAINT "ListPlant_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListPlant" ADD CONSTRAINT "ListPlant_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantPhoto" ADD CONSTRAINT "PlantPhoto_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
