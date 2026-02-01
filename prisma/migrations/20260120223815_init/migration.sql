-- CreateTable
CREATE TABLE "Plant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "light" TEXT,
    "water" TEXT,
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnedPlant" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnedPlant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistPlant" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistPlant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnedPlant_plantId_key" ON "OwnedPlant"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistPlant_plantId_key" ON "WishlistPlant"("plantId");

-- AddForeignKey
ALTER TABLE "OwnedPlant" ADD CONSTRAINT "OwnedPlant_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistPlant" ADD CONSTRAINT "WishlistPlant_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
