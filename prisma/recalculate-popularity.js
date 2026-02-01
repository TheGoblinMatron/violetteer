/**
 * Recalculate Plant Popularity Counts
 *
 * This script recalculates the collectionCount for all plants based on
 * actual ListPlant data. Run this periodically to ensure accuracy, or
 * after bulk data imports.
 *
 * Usage:
 *   npm run recalculate-popularity
 *
 * What it does:
 * 1. Counts distinct users who have each plant in their "My Collection"
 * 2. Updates the collectionCount field on each Plant
 * 3. Optionally updates lastCollected based on most recent addition
 * 4. Shows distribution statistics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recalculatePopularity() {
  console.log('=== Recalculating Plant Popularity ===\n');

  // Get total plants
  const totalPlants = await prisma.plant.count({ where: { isInCatalog: true } });
  console.log(`Found ${totalPlants} catalog plants\n`);

  // Get counts using raw SQL for efficiency
  console.log('Calculating collection counts...');

  const counts = await prisma.$queryRaw`
    SELECT
      p.id,
      COALESCE(COUNT(DISTINCT l."userId"), 0)::int as "userCount",
      MAX(lp."dateAdded") as "lastAdded"
    FROM "Plant" p
    LEFT JOIN "ListPlant" lp ON p.id = lp."plantId"
    LEFT JOIN "List" l ON lp."listId" = l.id AND l.name = 'My Collection'
    WHERE p."isInCatalog" = true
    GROUP BY p.id
  `;

  console.log(`Processing ${counts.length} plants...\n`);

  // Batch update plants
  let updated = 0;
  let changed = 0;

  for (const { id, userCount, lastAdded } of counts) {
    // Get current value to check if it changed
    const current = await prisma.plant.findUnique({
      where: { id },
      select: { collectionCount: true }
    });

    if (current.collectionCount !== userCount) {
      changed++;
    }

    await prisma.plant.update({
      where: { id },
      data: {
        collectionCount: userCount,
        lastCollected: lastAdded || null
      }
    });

    updated++;
    if (updated % 500 === 0) {
      console.log(`  Updated ${updated}/${counts.length} plants...`);
    }
  }

  console.log(`\nUpdated ${updated} plants (${changed} had count changes)`);

  // Show distribution stats
  console.log('\n=== Collection Count Distribution ===');

  const stats = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN "collectionCount" = 0 THEN '0 (likely extinct)'
        WHEN "collectionCount" BETWEEN 1 AND 3 THEN '1-3 (rare)'
        WHEN "collectionCount" BETWEEN 4 AND 10 THEN '4-10 (uncommon)'
        WHEN "collectionCount" BETWEEN 11 AND 25 THEN '11-25 (common)'
        ELSE '26+ (popular)'
      END as tier,
      COUNT(*)::int as count,
      ROUND(COUNT(*) * 100.0 / ${totalPlants}, 1) as percentage
    FROM "Plant"
    WHERE "isInCatalog" = true
    GROUP BY 1
    ORDER BY MIN("collectionCount")
  `;

  for (const row of stats) {
    console.log(`  ${row.tier}: ${row.count} plants (${row.percentage}%)`);
  }

  // Show extinction candidates
  const extinctCount = await prisma.plant.count({
    where: { isInCatalog: true, collectionCount: 0 }
  });

  console.log(`\n=== Extinction Summary ===`);
  console.log(`  Plants with 0 collectors: ${extinctCount} (${((extinctCount / totalPlants) * 100).toFixed(1)}%)`);

  // Top 10 most popular
  console.log('\n=== Top 10 Most Popular ===');
  const topPlants = await prisma.plant.findMany({
    where: { isInCatalog: true },
    orderBy: { collectionCount: 'desc' },
    take: 10,
    select: { name: true, collectionCount: true }
  });

  topPlants.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (${p.collectionCount} collectors)`);
  });

  console.log('\n=== Done! ===');
}

recalculatePopularity()
  .catch((e) => {
    console.error('Error recalculating popularity:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
