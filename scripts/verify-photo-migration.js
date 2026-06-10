#!/usr/bin/env node
/**
 * Post-migration verification. Run AFTER migrate-photos-to-plant-photo.js
 * and BEFORE the drop_legacy_plant_photo_columns migration — the sanity
 * sample compares against Plant.imageUrl, which is dropped after Task 24.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Counts by source
  const bySource = await prisma.plantPhoto.groupBy({
    by: ['source'],
    _count: { _all: true },
  });
  console.log('PlantPhoto rows by source:', bySource);

  // Plants that have an imageUrl but no primaryPhotoId — should be 0
  const orphanedImageUrl = await prisma.plant.count({
    where: { imageUrl: { not: null }, primaryPhotoId: null },
  });
  console.log(`Plants with imageUrl but no primaryPhotoId: ${orphanedImageUrl} (expect 0)`);

  // Sanity sample: 10 random plants — primary photo URL matches old imageUrl
  const sample = await prisma.plant.findMany({
    where: { primaryPhotoId: { not: null } },
    take: 10,
    select: {
      id: true,
      imageUrl: true,
      primaryPhoto: { select: { imageUrl: true } },
    },
  });
  let mismatches = 0;
  for (const p of sample) {
    const match = p.imageUrl === p.primaryPhoto?.imageUrl;
    if (!match) mismatches++;
    console.log(`  Plant ${p.id}: ${match ? '✓' : '✗'} old=${p.imageUrl} new=${p.primaryPhoto?.imageUrl}`);
  }
  console.log(`Sanity sample: ${mismatches} mismatches out of ${sample.length} (expect 0)`);

  // Orphaned PlantPhoto rows — plantId not matching any Plant. Should be 0.
  // (Prisma doesn't expose anti-join easily; raw SQL is clearest.)
  const orphanedPhotos = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "PlantPhoto" pp
    LEFT JOIN "Plant" p ON p.id = pp."plantId"
    WHERE p.id IS NULL
  `;
  console.log(`Orphaned PlantPhoto rows: ${orphanedPhotos[0].count} (expect 0)`);

  // Photographer attribution coverage — should be in the thousands after
  // the avml.db credits backfill landed.
  const credited = await prisma.plantPhoto.count({
    where: { photographerName: { not: null } },
  });
  console.log(`PlantPhoto rows with photographerName set: ${credited} (expect thousands)`);

  const topPhotographers = await prisma.$queryRaw`
    SELECT "photographerName", COUNT(*)::int AS photo_count
    FROM "PlantPhoto"
    WHERE "photographerName" IS NOT NULL
    GROUP BY "photographerName"
    ORDER BY photo_count DESC
    LIMIT 5
  `;
  console.log('Top photographers by photo count:');
  for (const row of topPhotographers) {
    console.log(`  ${row.photographerName}: ${row.photo_count}`);
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
