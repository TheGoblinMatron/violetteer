/**
 * generate-color-tags.js - Auto-generate color tags for plants based on blossom descriptions
 *
 * This script:
 * 1. Creates color tags in the Tag table (if they don't exist)
 * 2. Scans all plant blossom descriptions for color keywords
 * 3. Creates PlantTag entries linking plants to matching colors
 *
 * Run: node scripts/generate-color-tags.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Color families with their keywords and display properties
 *
 * Based on analysis of actual blossom descriptions in the database.
 * Keywords are matched as whole words (case-insensitive).
 */
const COLOR_FAMILIES = {
  pink: {
    displayName: 'Pink',
    color: '#FF69B4',  // Hot pink
    keywords: ['pink', 'coral', 'salmon', 'blush', 'rose'],
    sortOrder: 1,
  },
  red: {
    displayName: 'Red',
    color: '#DC143C',  // Crimson
    keywords: ['red', 'burgundy', 'raspberry', 'cherry', 'ruby', 'scarlet', 'cranberry', 'wine', 'crimson'],
    sortOrder: 2,
  },
  purple: {
    displayName: 'Purple',
    color: '#8B008B',  // Dark magenta
    keywords: ['purple', 'plum', 'grape', 'violet', 'magenta', 'fuchsia', 'orchid'],
    sortOrder: 3,
  },
  lavender: {
    displayName: 'Lavender',
    color: '#E6E6FA',  // Lavender
    keywords: ['lavender', 'lilac', 'mauve', 'periwinkle'],
    sortOrder: 4,
  },
  blue: {
    displayName: 'Blue',
    color: '#4169E1',  // Royal blue
    keywords: ['blue', 'cobalt', 'navy', 'azure', 'sapphire', 'sky'],
    sortOrder: 5,
  },
  white: {
    displayName: 'White',
    color: '#FFFFFF',  // White (will need border in UI)
    keywords: ['white', 'cream', 'ivory', 'snow'],
    sortOrder: 6,
  },
  yellow: {
    displayName: 'Yellow',
    color: '#FFD700',  // Gold
    keywords: ['yellow', 'gold', 'lemon', 'butter', 'canary'],
    sortOrder: 7,
  },
  green: {
    displayName: 'Green',
    color: '#228B22',  // Forest green
    keywords: ['green', 'lime', 'chartreuse', 'mint', 'emerald'],
    sortOrder: 8,
  },
  multicolor: {
    displayName: 'Multicolor',
    color: '#FF00FF',  // Will use gradient in UI
    keywords: ['fantasy', 'chimera', 'pinwheel', 'stripe', 'splash'],
    sortOrder: 9,
  },
};

/**
 * Create color tags in the database
 */
async function createColorTags() {
  console.log('Creating color tags...\n');

  const tags = [];
  for (const [name, config] of Object.entries(COLOR_FAMILIES)) {
    const tag = await prisma.tag.upsert({
      where: { category_name: { category: 'color', name } },
      update: {
        displayName: config.displayName,
        color: config.color,
        sortOrder: config.sortOrder,
      },
      create: {
        category: 'color',
        name,
        displayName: config.displayName,
        color: config.color,
        sortOrder: config.sortOrder,
      },
    });
    tags.push(tag);
    console.log(`  ✓ ${tag.displayName} (id: ${tag.id})`);
  }

  return tags;
}

/**
 * Build a regex pattern that matches any keyword for a color family
 */
function buildColorRegex(keywords) {
  // Match whole words only, case-insensitive
  const pattern = keywords.map(k => `\\b${k}\\b`).join('|');
  return new RegExp(pattern, 'i');
}

/**
 * Detect which color families match a blossom description
 */
function detectColors(blossomText) {
  if (!blossomText) return [];

  const matches = [];
  for (const [colorName, config] of Object.entries(COLOR_FAMILIES)) {
    const regex = buildColorRegex(config.keywords);
    if (regex.test(blossomText)) {
      matches.push(colorName);
    }
  }
  return matches;
}

/**
 * Tag all plants with their detected colors
 */
async function tagPlants(tags) {
  console.log('\nTagging plants...\n');

  // Build a map of tag name -> tag id
  const tagMap = {};
  for (const tag of tags) {
    tagMap[tag.name] = tag.id;
  }

  // Get all plants with blossom descriptions
  const plants = await prisma.plant.findMany({
    where: { blossom: { not: null } },
    select: { id: true, blossom: true },
  });

  console.log(`Processing ${plants.length} plants...\n`);

  // Track statistics
  const stats = {
    totalPlants: plants.length,
    plantsTagged: 0,
    tagCounts: {},
  };
  for (const colorName of Object.keys(COLOR_FAMILIES)) {
    stats.tagCounts[colorName] = 0;
  }

  // Process in batches
  const BATCH_SIZE = 100;
  let processed = 0;

  for (let i = 0; i < plants.length; i += BATCH_SIZE) {
    const batch = plants.slice(i, i + BATCH_SIZE);
    const plantTagsToCreate = [];

    for (const plant of batch) {
      const colors = detectColors(plant.blossom);

      if (colors.length > 0) {
        stats.plantsTagged++;
        for (const colorName of colors) {
          stats.tagCounts[colorName]++;
          plantTagsToCreate.push({
            plantId: plant.id,
            tagId: tagMap[colorName],
            source: 'auto',
            confidence: 1.0,  // Keyword match = high confidence
          });
        }
      }
    }

    // Batch insert (skip duplicates)
    if (plantTagsToCreate.length > 0) {
      await prisma.plantTag.createMany({
        data: plantTagsToCreate,
        skipDuplicates: true,
      });
    }

    processed += batch.length;
    const percent = Math.round((processed / plants.length) * 100);
    process.stdout.write(`\rProcessed: ${processed}/${plants.length} (${percent}%)`);
  }

  console.log('\n\n--- Results ---\n');
  console.log(`Total plants: ${stats.totalPlants}`);
  console.log(`Plants tagged: ${stats.plantsTagged} (${Math.round(stats.plantsTagged / stats.totalPlants * 100)}%)`);
  console.log(`Plants without color: ${stats.totalPlants - stats.plantsTagged}\n`);

  console.log('Tags by color:');
  for (const [colorName, count] of Object.entries(stats.tagCounts).sort((a, b) => b[1] - a[1])) {
    const config = COLOR_FAMILIES[colorName];
    console.log(`  ${config.displayName}: ${count}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Color Tag Generator ===\n');

  // Step 1: Create tags
  const tags = await createColorTags();

  // Step 2: Tag plants
  await tagPlants(tags);

  console.log('\nDone!');
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
