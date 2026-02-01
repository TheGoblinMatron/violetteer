/**
 * backfill-descriptions.js - One-time script to generate descriptions for existing plants
 *
 * Run this after adding the 'description' field to the schema and running the migration:
 *   npx prisma migrate dev --name add_plant_description
 *   node scripts/backfill-descriptions.js
 *
 * This script:
 * 1. Fetches all plants from the database
 * 2. Generates a description for each one
 * 3. Updates the plant with the generated description
 * 4. Processes in batches to avoid overwhelming the database
 */

import { PrismaClient } from '@prisma/client';
import { generateDescription } from '../server/lib/plantDescription.js';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function backfillDescriptions() {
  console.log('Starting description backfill...\n');

  // Get total count
  const totalCount = await prisma.plant.count();
  console.log(`Total plants to process: ${totalCount}`);

  let processed = 0;
  let updated = 0;

  // Process in batches
  while (processed < totalCount) {
    const plants = await prisma.plant.findMany({
      skip: processed,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' }
    });

    // Update each plant with its generated description
    for (const plant of plants) {
      const description = generateDescription(plant);

      // Only update if description is different (or was null)
      if (plant.description !== description) {
        await prisma.plant.update({
          where: { id: plant.id },
          data: { description }
        });
        updated++;
      }
    }

    processed += plants.length;
    const percent = Math.round((processed / totalCount) * 100);
    process.stdout.write(`\rProcessed: ${processed}/${totalCount} (${percent}%) - Updated: ${updated}`);
  }

  console.log('\n\nBackfill complete!');
  console.log(`Total processed: ${processed}`);
  console.log(`Total updated: ${updated}`);
}

backfillDescriptions()
  .catch((error) => {
    console.error('Error during backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
