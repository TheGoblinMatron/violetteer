-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantTag" (
    "id" SERIAL NOT NULL,
    "plantId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tag_category_idx" ON "Tag"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_category_name_key" ON "Tag"("category", "name");

-- CreateIndex
CREATE INDEX "PlantTag_tagId_idx" ON "PlantTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantTag_plantId_tagId_key" ON "PlantTag"("plantId", "tagId");

-- AddForeignKey
ALTER TABLE "PlantTag" ADD CONSTRAINT "PlantTag_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantTag" ADD CONSTRAINT "PlantTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
