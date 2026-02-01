/**
 * Test Data Generator
 *
 * Generates ~5,000 fictional plant entries for testing pagination and performance.
 * All names are completely made up - no similarity to real AVSA varieties.
 *
 * Usage:
 *   npm run generate-test-data
 *
 * Or to reset and generate fresh:
 *   npx prisma migrate reset --force && npm run generate-test-data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// FICTIONAL VOCABULARY
// ============================================

// Adjectives for plant names
const adjectives = [
  'Gleaming', 'Whispering', 'Velvet', 'Frosty', 'Dancing', 'Hidden', 'Gentle',
  'Luminous', 'Twilight', 'Serene', 'Mystic', 'Radiant', 'Tranquil', 'Ethereal',
  'Enchanted', 'Drifting', 'Shimmering', 'Wandering', 'Peaceful', 'Dreaming',
  'Golden', 'Silver', 'Crimson', 'Azure', 'Emerald', 'Ivory', 'Obsidian',
  'Celestial', 'Gossamer', 'Dusky', 'Blushing', 'Sparkling', 'Misty', 'Glowing',
  'Silken', 'Tender', 'Bold', 'Quiet', 'Spirited', 'Graceful', 'Timeless',
  'Fleeting', 'Delicate', 'Vivid', 'Mellow', 'Wistful', 'Jovial', 'Solemn'
];

// Nouns for plant names
const nouns = [
  'Moonbeam', 'Stardust', 'Willow', 'Meadow', 'Zephyr', 'Ember', 'Aurora',
  'Cascade', 'Whisper', 'Velvet', 'Petal', 'Dewdrop', 'Sunrise', 'Twilight',
  'Harmony', 'Serenade', 'Sonata', 'Lullaby', 'Echo', 'Mirage', 'Oasis',
  'Horizon', 'Zenith', 'Solstice', 'Equinox', 'Nebula', 'Comet', 'Galaxy',
  'Reverie', 'Bliss', 'Haven', 'Sanctuary', 'Refuge', 'Paradise', 'Eden',
  'Breeze', 'Gale', 'Storm', 'Mist', 'Fog', 'Rain', 'Snow', 'Frost',
  'Brook', 'River', 'Lake', 'Ocean', 'Wave', 'Tide', 'Current', 'Spring',
  'Fern', 'Moss', 'Ivy', 'Clover', 'Thistle', 'Bramble', 'Heather', 'Laurel'
];

// Made-up hybridizer names (no similarity to real people)
const hybridizers = [
  'T. Fernwood', 'M. Ashbrook', 'K. Willowmere', 'J. Thornberry', 'S. Clearwater',
  'R. Hollowell', 'P. Silverstone', 'L. Mossdale', 'A. Wintergreen', 'E. Foxglove',
  'C. Briarwood', 'D. Heatherton', 'F. Oakenshield', 'G. Willowbrook', 'H. Ferndale',
  'I. Brookstone', 'N. Ashworth', 'O. Thornhill', 'Q. Meadowcroft', 'U. Starling',
  'V. Nightingale', 'W. Larkwood', 'X. Finchley', 'Y. Swiftwater', 'Z. Birchwood'
];

// Habits with weighted distribution
const habits = [
  { name: 'Standard', weight: 40 },
  { name: 'Semiminiature', weight: 25 },
  { name: 'Miniature', weight: 15 },
  { name: 'Large', weight: 5 },
  { name: 'Small Standard', weight: 5 },
  { name: 'Trailer', weight: 4 },
  { name: 'Standard Trailer', weight: 2 },
  { name: 'Semiminiature Trailer', weight: 2 },
  { name: 'Miniature Trailer', weight: 2 }
];

// Blossom components
const blossomForms = ['Single', 'Semidouble', 'Double'];
const blossomColors = [
  'pink', 'blue', 'purple', 'white', 'red', 'coral', 'lavender', 'mauve',
  'violet', 'raspberry', 'plum', 'burgundy', 'rose', 'magenta', 'fuchsia',
  'light pink', 'dark blue', 'pale lavender', 'deep purple', 'bright red'
];
const blossomShapes = ['star', 'pansy', 'bell', 'wasp'];
const blossomModifiers = [
  '', '', '',  // Empty for variety (no modifier)
  'frilled', 'ruffled', 'with white edge', 'with green edge',
  'with pink fantasy', 'with blue fantasy', 'with darker center',
  'with lighter center', 'with veining', 'with speckling'
];

// Foliage components
const foliageColors = [
  'Dark green', 'Medium green', 'Light green',
  'Variegated medium green and white', 'Variegated dark green and pink',
  'Variegated light green and cream'
];
const foliageTextures = ['plain', 'quilted', 'serrated', 'spooned', 'wavy'];
const foliageFeatures = [
  '', '', '',  // Empty for variety
  'girl-type', 'pointed', 'heart-shaped', 'red back', 'ruffled edge'
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function pickWeighted(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.name;
  }
  return items[0].name;
}

function generatePlantName(index) {
  // Different patterns for variety
  const pattern = index % 4;

  switch (pattern) {
    case 0:
      // "Adjective Noun" - e.g., "Gleaming Stardust"
      return `${pick(adjectives)} ${pick(nouns)}`;
    case 1:
      // "Noun Noun" - e.g., "Moonbeam Cascade"
      return `${pick(nouns)} ${pick(nouns)}`;
    case 2:
      // "Adjective Adjective Noun" - e.g., "Velvet Twilight Whisper"
      return `${pick(adjectives)} ${pick(adjectives)} ${pick(nouns)}`;
    case 3:
      // "The Adjective Noun" - e.g., "The Hidden Meadow"
      return `The ${pick(adjectives)} ${pick(nouns)}`;
    default:
      return `${pick(adjectives)} ${pick(nouns)}`;
  }
}

function generateBlossom() {
  const form = pick(blossomForms);
  const color = pick(blossomColors);
  const shape = pick(blossomShapes);
  const modifier = pick(blossomModifiers);

  let description = `${form} ${color} ${shape}`;
  if (modifier) {
    description += ` ${modifier}`;
  }
  return description + '.';
}

function generateFoliage() {
  const color = pick(foliageColors);
  const texture = pick(foliageTextures);
  const feature = pick(foliageFeatures);

  let description = `${color}, ${texture}`;
  if (feature) {
    description += `, ${feature}`;
  }
  return description + '.';
}

function generateRegDate() {
  // Random date between 2000 and 2024
  const year = 2000 + Math.floor(Math.random() * 25);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generatePlant(index) {
  const regDate = generateRegDate();
  const vintage = regDate.substring(0, 4);

  return {
    recNum: 1000 + index,  // Start after seed data
    name: generatePlantName(index),
    hybridizer: pick(hybridizers),
    habit: pickWeighted(habits),
    regNum: String(50000 + index),  // Fictional registration numbers
    regDate: regDate,
    blossom: generateBlossom(),
    foliage: generateFoliage(),
    vintage: vintage,
    isInCatalog: true
  };
}

// ============================================
// MAIN GENERATOR
// ============================================

const BATCH_SIZE = 500;
const TOTAL_PLANTS = 5000;

async function main() {
  console.log(`Generating ${TOTAL_PLANTS} fictional test plants...`);
  console.log('');

  const startTime = Date.now();

  for (let i = 0; i < TOTAL_PLANTS; i += BATCH_SIZE) {
    const batch = [];
    const batchEnd = Math.min(i + BATCH_SIZE, TOTAL_PLANTS);

    for (let j = i; j < batchEnd; j++) {
      batch.push(generatePlant(j));
    }

    await prisma.plant.createMany({ data: batch });
    console.log(`  Inserted ${batchEnd} / ${TOTAL_PLANTS} plants`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`Done! Generated ${TOTAL_PLANTS} plants in ${elapsed}s`);

  // Show a few examples
  console.log('');
  console.log('Sample generated plants:');
  const samples = await prisma.plant.findMany({
    where: { recNum: { gte: 1000 } },
    take: 5,
    orderBy: { id: 'desc' }
  });

  for (const plant of samples) {
    console.log(`  - ${plant.name} (${plant.habit}) by ${plant.hybridizer}`);
  }
}

main()
  .catch((e) => {
    console.error('Error generating test data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
