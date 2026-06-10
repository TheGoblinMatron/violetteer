-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "primaryPhotoId" INTEGER;

-- AlterTable
ALTER TABLE "PlantPhoto" ADD COLUMN     "attributionNote" TEXT,
ADD COLUMN     "photographerName" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "UserPlant" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Plant_primaryPhotoId_key" ON "Plant"("primaryPhotoId");

-- CreateIndex
CREATE INDEX "PlantPhoto_plantId_source_idx" ON "PlantPhoto"("plantId", "source");

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_primaryPhotoId_fkey" FOREIGN KEY ("primaryPhotoId") REFERENCES "PlantPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
