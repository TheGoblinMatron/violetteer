/**
 * Generate Test Users with Plant Collections
 *
 * Creates simulated users with realistic plant collection distributions
 * for testing popularity-based sorting and extinction tracking.
 *
 * Distribution strategy (matching real-world African violet collecting):
 * - 10% of plants are "popular" (owned by 30-50% of users)
 * - 25% are "common" (owned by 10-30% of users)
 * - 40% are "uncommon" (owned by 1-10% of users)
 * - 25% are "rare/extinct" (owned by 0-1% of users)
 *
 * Usage:
 *   npm run generate-test-users
 *
 * Note: Users are inserted directly into the database, bypassing Better Auth.
 * These are test-only accounts that cannot log in.
 */

import { PrismaClient } from '@prisma/client';

// ============================================================
// STALE-SCHEMA GUARD (2026-06-08)
// This script writes ListPlant rows directly with plantId, and
// runs a raw SQL join through ListPlant.plantId. Both broken
// after the 20260307201829_add_user_plant migration.
// Update before use: see prisma/seed.js for the new pattern.
// Short version: create one UserPlant per (userId, catalogPlantId),
// then ListPlant with userPlantId. Raw SQL: Plant -> UserPlant
// -> ListPlant -> List. Add userPlant.deleteMany() to cleanup.
// ============================================================
console.error('[stale-schema] prisma/generate-test-users.js targets the pre-UserPlant schema and must be updated before use. See header comment.');
process.exit(1);

const prisma = new PrismaClient();

const TOTAL_USERS = 75;

/**
 * Fisher-Yates shuffle algorithm
 * Randomly reorders an array in place
 */
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Select plants for a user based on popularity tier probabilities
 *
 * @param {Array} popular - Plants that should be commonly owned (40% chance each)
 * @param {Array} common - Plants with moderate ownership (20% chance each)
 * @param {Array} uncommon - Plants with low ownership (5% chance each)
 * @param {Array} rare - Plants rarely owned (0.5% chance each)
 * @returns {Array} Array of plant IDs for this user's collection
 */
function selectPlantsForUser(popular, common, uncommon, rare) {
  const selected = [];

  // Each popular plant: 40% chance of being selected
  popular.forEach(p => {
    if (Math.random() < 0.40) selected.push(p.id);
  });

  // Each common plant: 20% chance
  common.forEach(p => {
    if (Math.random() < 0.20) selected.push(p.id);
  });

  // Each uncommon plant: 5% chance
  uncommon.forEach(p => {
    if (Math.random() < 0.05) selected.push(p.id);
  });

  // Each rare plant: 0.5% chance (most will have 0 owners)
  rare.forEach(p => {
    if (Math.random() < 0.005) selected.push(p.id);
  });

  return selected;
}

/**
 * Recalculate collectionCount for all plants based on actual data
 */
async function recalculateAllCounts() {
  console.log('\nRecalculating collection counts...');

  // Get counts using raw SQL for efficiency
  const counts = await prisma.$queryRaw`
    SELECT
      p.id,
      COALESCE(COUNT(DISTINCT l."userId"), 0)::int as "userCount"
    FROM "Plant" p
    LEFT JOIN "ListPlant" lp ON p.id = lp."plantId"
    LEFT JOIN "List" l ON lp."listId" = l.id AND l.name = 'My Collection'
    GROUP BY p.id
  `;

  // Batch update plants
  let updated = 0;
  for (const { id, userCount } of counts) {
    await prisma.plant.update({
      where: { id },
      data: { collectionCount: userCount }
    });
    updated++;
    if (updated % 500 === 0) {
      console.log(`  Updated ${updated}/${counts.length} plants...`);
    }
  }

  console.log(`  Updated ${updated} plants total`);
}

async function generateTestUsers() {
  console.log('=== Generating Test Users ===\n');

  // Check for existing test users
  const existingTestUsers = await prisma.user.count({
    where: { id: { startsWith: 'test-user-' } }
  });

  if (existingTestUsers > 0) {
    console.log(`Found ${existingTestUsers} existing test users.`);
    console.log('Deleting existing test users and their data...\n');

    // Delete in correct order due to foreign keys
    await prisma.listPlant.deleteMany({
      where: { list: { user: { id: { startsWith: 'test-user-' } } } }
    });
    await prisma.list.deleteMany({
      where: { user: { id: { startsWith: 'test-user-' } } }
    });
    await prisma.user.deleteMany({
      where: { id: { startsWith: 'test-user-' } }
    });
    console.log('Existing test users deleted.\n');
  }

  // Get all catalog plants
  const allPlants = await prisma.plant.findMany({
    where: { isInCatalog: true },
    select: { id: true }
  });

  console.log(`Found ${allPlants.length} catalog plants\n`);

  if (allPlants.length === 0) {
    console.log('No catalog plants found! Run seed first.');
    return;
  }

  // Shuffle and assign to popularity tiers
  const shuffled = shuffle(allPlants);
  const popularCount = Math.floor(allPlants.length * 0.10);
  const commonCount = Math.floor(allPlants.length * 0.25);
  const uncommonCount = Math.floor(allPlants.length * 0.40);

  const popular = shuffled.slice(0, popularCount);
  const common = shuffled.slice(popularCount, popularCount + commonCount);
  const uncommon = shuffled.slice(popularCount + commonCount, popularCount + commonCount + uncommonCount);
  const rare = shuffled.slice(popularCount + commonCount + uncommonCount);

  console.log('Popularity tier distribution:');
  console.log(`  Popular (40% ownership chance): ${popular.length} plants`);
  console.log(`  Common (20% ownership chance): ${common.length} plants`);
  console.log(`  Uncommon (5% ownership chance): ${uncommon.length} plants`);
  console.log(`  Rare (0.5% ownership chance): ${rare.length} plants`);
  console.log('');

  // Generate users
  let totalPlantsAdded = 0;

  for (let i = 0; i < TOTAL_USERS; i++) {
    // Create user directly in DB (bypassing Better Auth - test data only)
    const userId = `test-user-${i.toString().padStart(4, '0')}`;

    const user = await prisma.user.create({
      data: {
        id: userId,
        name: `Test User ${i + 1}`,
        email: `testuser${i}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    // Create their "My Collection" list
    const collection = await prisma.list.create({
      data: {
        userId: user.id,
        name: 'My Collection',
        isDefault: true
      }
    });

    // Also create a Wishlist for completeness
    await prisma.list.create({
      data: {
        userId: user.id,
        name: 'Wishlist',
        isDefault: true
      }
    });

    // Select plants based on probability distribution
    const userPlants = selectPlantsForUser(popular, common, uncommon, rare);
    totalPlantsAdded += userPlants.length;

    // Add plants to collection
    if (userPlants.length > 0) {
      await prisma.listPlant.createMany({
        data: userPlants.map(plantId => ({
          listId: collection.id,
          plantId,
          dateAdded: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date within last year
        }))
      });
    }

    console.log(`Created user ${i + 1}/${TOTAL_USERS}: ${user.name} with ${userPlants.length} plants`);
  }

  console.log(`\nTotal: ${TOTAL_USERS} users, ${totalPlantsAdded} plant additions`);
  console.log(`Average collection size: ${Math.round(totalPlantsAdded / TOTAL_USERS)} plants per user`);

  // Recalculate all collection counts
  await recalculateAllCounts();

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
      COUNT(*)::int as count
    FROM "Plant"
    WHERE "isInCatalog" = true
    GROUP BY 1
    ORDER BY
      MIN("collectionCount")
  `;

  for (const row of stats) {
    console.log(`  ${row.tier}: ${row.count} plants`);
  }

  // Show top 10 most popular
  console.log('\n=== Top 10 Most Popular Plants ===');
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

generateTestUsers()
  .catch((e) => {
    console.error('Error generating test users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
