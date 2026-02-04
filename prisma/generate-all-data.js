/**
 * generate-all-data.js - Unified Data Generator for Violetteer
 *
 * This script orchestrates all data generation in the correct order.
 * It consolidates logic from multiple scripts to ensure consistent database state.
 *
 * EXECUTION ORDER (dependencies flow downward):
 *   1. Clear existing data
 *   2. Create demo user + 20 demo plants + default lists
 *   3. Generate 5,000 test plants
 *   4. Create color tags and auto-tag plants
 *   5. Compute plant descriptions
 *   6. Create 75 test users with realistic collections
 *   7. Print summary
 *
 * WHY ORDER MATTERS (for learning):
 *   - Lists require a userId (foreign key), so users must exist first
 *   - ListPlant links plantId to listId, so both must exist
 *   - Tags reference plants, so plants must exist first
 *   - Prisma enforces these constraints - wrong order = error
 *
 * Usage:
 *   npm run generate-all
 */

import { PrismaClient } from '@prisma/client';
import { generateDescription } from '../server/lib/plantDescription.js';

const prisma = new PrismaClient();

// ============================================
// STEP 1: CLEAR DATA
// ============================================

async function clearData() {
  console.log('Clearing existing data...');

  // Delete in reverse dependency order (children before parents)
  // This is CRITICAL - deleting a parent with children violates foreign key constraints
  await prisma.plantTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.review.deleteMany();
  await prisma.plantPhoto.deleteMany();
  await prisma.listPlant.deleteMany();
  await prisma.list.deleteMany();
  await prisma.plant.deleteMany();

  // Delete auth-related tables
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  console.log('  ✓ Cleared all data\n');
}

// ============================================
// STEP 2: SEED FOUNDATION DATA
// ============================================

// Habit codes from AVSA (African Violet Society of America)
const habitMap = {
  '1': 'Standard',
  '2': 'Semiminiature',
  '3': 'Miniature',
  '4': 'Large',
  '5': 'Small Standard',
  '6': 'Trailer',
  '7': 'Standard Trailer',
  '8': 'Semiminiature Trailer',
  '9': 'Miniature Trailer',
  '10': 'Saintpaulia species'
};

async function seedFoundation() {
  console.log('Step 1/6: Creating foundation data...');

  // Create demo user
  const demoUser = await prisma.user.create({
    data: {
      id: 'demo-user-001',
      email: 'demo@violetteer.com',
      name: 'Demo User',
      emailVerified: true,
      isAdmin: true,
    }
  });
  console.log('  ✓ Created demo user (demo@violetteer.com)');

  // Create default lists for demo user
  const myCollectionList = await prisma.list.create({
    data: {
      userId: demoUser.id,
      name: 'My Collection',
      description: 'Plants I own',
      color: '#4caf50',
      isDefault: true,
      isPublic: false
    }
  });

  const wishlistList = await prisma.list.create({
    data: {
      userId: demoUser.id,
      name: 'Wishlist',
      description: 'Plants I want to acquire',
      color: '#2196f3',
      isDefault: true,
      isPublic: false
    }
  });

  // Create 20 demo plants with real Cloudinary images
  const demoPlants = [
    { recNum: 1, name: 'Moonlight Serenade', hybridizer: 'J. Martinez', habit: habitMap['1'], regNum: '10234', regDate: '2015-03-15', blossom: 'Double white star with pale blue center.', foliage: 'Medium green, plain, quilted.', vintage: '2015', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464170/african-violets/wusp0r7qmypjkw3ah1zb.jpg' },
    { recNum: 2, name: 'Berry Burst', hybridizer: 'S. Chen', habit: habitMap['2'], regNum: '11456', regDate: '2018-06-22', blossom: 'Semidouble raspberry-red frilled star with white edge.', foliage: 'Dark green, plain, pointed/red back.', vintage: '2018', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464094/african-violets/atws0renxlgpwcziz7wb.jpg' },
    { recNum: 3, name: 'Lavender Dreams', hybridizer: 'R. Thompson', habit: habitMap['3'], regNum: '9877', regDate: '2012-11-08', blossom: 'Single lavender bell with darker veining.', foliage: 'Variegated light green and white, plain.', vintage: '2012', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464452/african-violets/sm1gxhpxvjblubfsktks.jpg' },
    { recNum: 4, name: 'Purple Majesty', hybridizer: 'D. Williams', habit: habitMap['4'], regNum: '10567', regDate: '2016-02-14', blossom: 'Double dark purple ruffled star.', foliage: 'Dark green, quilted, heart-shaped.', altReg: 'Western 2016', vintage: '2016', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464816/african-violets/znpva73lu0hjptxlp2mn.jpg' },
    { recNum: 5, name: 'Coral Sunset', hybridizer: 'M. Anderson', habit: habitMap['1'], regNum: '11234', regDate: '2017-09-30', blossom: 'Semidouble coral-pink star with yellow undertones.', foliage: 'Medium green, plain, serrated.', vintage: '2017', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769463863/african-violets/okdc73qohcuprd03fql9.jpg' },
    { recNum: 6, name: 'Midnight Fantasy', hybridizer: 'K. Petrov', habit: habitMap['1'], regNum: '10789', regDate: '2016-07-19', blossom: 'Double dark blue-purple star with pink fantasy.', foliage: 'Dark green, plain, quilted/red back.', vintage: '2016', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464568/african-violets/ahlwfwxkkrtwadfk1cex.jpg' },
    { recNum: 7, name: 'Tiny Treasure', hybridizer: 'L. Kim', habit: habitMap['3'], regNum: '11678', regDate: '2019-04-12', blossom: 'Single pink star.', foliage: 'Medium green, plain, girl.', vintage: '2019', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465051/african-violets/u80icq68mymia4z2hyia.jpg' },
    { recNum: 8, name: 'Waterfall Blues', hybridizer: 'P. Johnson', habit: habitMap['6'], regNum: '10123', regDate: '2014-12-03', blossom: 'Semidouble light blue frilled star.', foliage: 'Medium green, plain, quilted.', vintage: '2014', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465184/african-violets/tse9x7qtzjuzyapxkvdg.jpg' },
    { recNum: 9, name: 'Crimson Velvet', hybridizer: 'T. Garcia', habit: habitMap['1'], regNum: '11890', regDate: '2020-01-25', blossom: 'Double deep red ruffled star with darker center.', foliage: 'Dark green, plain, pointed.', vintage: '2020', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464247/african-violets/tnwvnuzlwckbndwtpjzd.jpg' },
    { recNum: 10, name: 'Snow Princess', hybridizer: 'A. Ivanova', habit: habitMap['2'], regNum: '9654', regDate: '2011-05-17', blossom: 'Double white frilled star with light pink blush.', foliage: 'Variegated medium green and white, plain, quilted.', vintage: '2011', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464938/african-violets/sm8g5iyzdruaitjx4dix.jpg' },
    { recNum: 11, name: 'Plum Delight', hybridizer: 'N. Brown', habit: habitMap['5'], regNum: '10445', regDate: '2015-10-09', blossom: 'Semidouble plum-purple star with white edge.', foliage: 'Medium green, plain, heart-shaped.', vintage: '2015', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464721/african-violets/tqgjru6qtxfvzf51gsoq.jpg' },
    { recNum: 12, name: 'Blueberry Muffin', hybridizer: 'E. Taylor', habit: habitMap['1'], regNum: '11567', regDate: '2018-11-20', blossom: 'Double medium blue ruffled star with darker blue fantasy.', foliage: 'Medium green, quilted, plain.', vintage: '2018', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769463920/african-violets/zeisnrcbscdlpaksxnkx.jpg' },
    { recNum: 13, name: 'Pink Lemonade', hybridizer: "C. O'Brien", habit: habitMap['2'], regNum: '10998', regDate: '2017-03-28', blossom: 'Single-semidouble light pink star with yellow center.', foliage: 'Light green, plain, quilted.', vintage: '2017', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464677/african-violets/ih0pxhl79ygivjlvq711.jpg' },
    { recNum: 14, name: 'Raspberry Ripple', hybridizer: 'H. Lee', habit: habitMap['7'], regNum: '11223', regDate: '2017-08-14', blossom: 'Semidouble pink and white chimera.', foliage: 'Medium green, plain, pointed.', vintage: '2017', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464876/african-violets/qiksavmu7aeoij8npr2m.jpg' },
    { recNum: 15, name: 'Starry Night', hybridizer: 'V. Kowalski', habit: habitMap['1'], regNum: '10334', regDate: '2015-06-05', blossom: 'Double dark blue star with white fantasy.', foliage: 'Dark green, quilted, plain/red back.', vintage: '2015', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464993/african-violets/erzegl8uw8n2igtengm6.jpg' },
    { recNum: 16, name: 'Little Gem', hybridizer: 'F. Murphy', habit: habitMap['3'], blossom: 'Single white star with pink blush.', foliage: 'Medium green, plain, girl.', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464501/african-violets/d7jwn749idgspawnuj3n.jpg' },
    { recNum: 17, name: 'Violet Cascade', hybridizer: 'B. Yamamoto', habit: habitMap['8'], regNum: '11789', regDate: '2019-10-18', blossom: 'Semidouble violet-purple star.', foliage: 'Variegated dark green and pink, plain.', vintage: '2019', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465146/african-violets/v0p7kjrzunyn6phpfxdp.jpg' },
    { recNum: 18, name: 'Peaches and Cream', hybridizer: 'G. Fischer', habit: habitMap['1'], regNum: '10656', regDate: '2016-04-22', blossom: 'Double peach-pink star with cream edge.', foliage: 'Medium green, plain, quilted.', vintage: '2016', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464624/african-violets/wb2tswzi3ty9huhyfhol.jpg' },
    { recNum: 19, name: 'Emerald City', hybridizer: 'W. Zhang', habit: habitMap['2'], regNum: '11445', regDate: '2018-02-09', blossom: 'Semidouble white star with green ruffled edge.', foliage: 'Variegated medium green and white, quilted, serrated.', vintage: '2018', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464409/african-violets/udgqd9a4qwkhrlpxahx4.jpg' },
    { recNum: 20, name: 'Wild Rose', hybridizer: 'I. Silva', habit: habitMap['9'], regNum: '10876', regDate: '2016-09-12', blossom: 'Single rose-pink frilled star.', foliage: 'Light green, plain, pointed.', altReg: 'TX 2016', vintage: '2016', imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465234/african-violets/th3xictcigfuxest0muj.jpg' },
  ];

  // Insert all demo plants
  const plants = await Promise.all(
    demoPlants.map(p => prisma.plant.create({ data: { ...p, isInCatalog: true } }))
  );
  console.log('  ✓ Created 20 demo plants');

  // Add some plants to demo user's collection
  const collectionPlants = [0, 1, 4, 6, 11]; // indices
  const wishlistPlants = [3, 8, 14];

  for (const idx of collectionPlants) {
    await prisma.listPlant.create({
      data: {
        listId: myCollectionList.id,
        plantId: plants[idx].id,
        notes: idx === 0 ? 'Bloomed beautifully last spring!' : idx === 1 ? 'Needs more light' : null
      }
    });
  }

  for (const idx of wishlistPlants) {
    await prisma.listPlant.create({
      data: { listId: wishlistList.id, plantId: plants[idx].id }
    });
  }

  console.log('  ✓ Created 2 default lists with 8 plants\n');
}

// ============================================
// STEP 3: GENERATE 5,000 TEST PLANTS
// ============================================

// Vocabulary for generating fictional plant names
const adjectives = [
  'Gleaming', 'Whispering', 'Velvet', 'Frosty', 'Dancing', 'Hidden', 'Gentle',
  'Luminous', 'Twilight', 'Serene', 'Mystic', 'Radiant', 'Tranquil', 'Ethereal',
  'Enchanted', 'Drifting', 'Shimmering', 'Wandering', 'Peaceful', 'Dreaming',
  'Golden', 'Silver', 'Crimson', 'Azure', 'Emerald', 'Ivory', 'Obsidian',
  'Celestial', 'Gossamer', 'Dusky', 'Blushing', 'Sparkling', 'Misty', 'Glowing',
  'Silken', 'Tender', 'Bold', 'Quiet', 'Spirited', 'Graceful', 'Timeless',
  'Fleeting', 'Delicate', 'Vivid', 'Mellow', 'Wistful', 'Jovial', 'Solemn'
];

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

const hybridizers = [
  'T. Fernwood', 'M. Ashbrook', 'K. Willowmere', 'J. Thornberry', 'S. Clearwater',
  'R. Hollowell', 'P. Silverstone', 'L. Mossdale', 'A. Wintergreen', 'E. Foxglove',
  'C. Briarwood', 'D. Heatherton', 'F. Oakenshield', 'G. Willowbrook', 'H. Ferndale',
  'I. Brookstone', 'N. Ashworth', 'O. Thornhill', 'Q. Meadowcroft', 'U. Starling',
  'V. Nightingale', 'W. Larkwood', 'X. Finchley', 'Y. Swiftwater', 'Z. Birchwood'
];

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

const blossomForms = ['Single', 'Semidouble', 'Double'];
const blossomColors = [
  'pink', 'blue', 'purple', 'white', 'red', 'coral', 'lavender', 'mauve',
  'violet', 'raspberry', 'plum', 'burgundy', 'rose', 'magenta', 'fuchsia',
  'light pink', 'dark blue', 'pale lavender', 'deep purple', 'bright red'
];
const blossomShapes = ['star', 'pansy', 'bell', 'wasp'];
const blossomModifiers = [
  '', '', '',
  'frilled', 'ruffled', 'with white edge', 'with green edge',
  'with pink fantasy', 'with blue fantasy', 'with darker center',
  'with lighter center', 'with veining', 'with speckling'
];

const foliageColors = [
  'Dark green', 'Medium green', 'Light green',
  'Variegated medium green and white', 'Variegated dark green and pink',
  'Variegated light green and cream'
];
const foliageTextures = ['plain', 'quilted', 'serrated', 'spooned', 'wavy'];
const foliageFeatures = ['', '', '', 'girl-type', 'pointed', 'heart-shaped', 'red back', 'ruffled edge'];

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
  const pattern = index % 4;
  switch (pattern) {
    case 0: return `${pick(adjectives)} ${pick(nouns)}`;
    case 1: return `${pick(nouns)} ${pick(nouns)}`;
    case 2: return `${pick(adjectives)} ${pick(adjectives)} ${pick(nouns)}`;
    case 3: return `The ${pick(adjectives)} ${pick(nouns)}`;
    default: return `${pick(adjectives)} ${pick(nouns)}`;
  }
}

function generateBlossom() {
  const form = pick(blossomForms);
  const color = pick(blossomColors);
  const shape = pick(blossomShapes);
  const modifier = pick(blossomModifiers);
  let desc = `${form} ${color} ${shape}`;
  if (modifier) desc += ` ${modifier}`;
  return desc + '.';
}

function generateFoliage() {
  const color = pick(foliageColors);
  const texture = pick(foliageTextures);
  const feature = pick(foliageFeatures);
  let desc = `${color}, ${texture}`;
  if (feature) desc += `, ${feature}`;
  return desc + '.';
}

function generateRegDate() {
  const year = 2000 + Math.floor(Math.random() * 25);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function generateTestPlants() {
  console.log('Step 2/6: Generating test plants...');

  const BATCH_SIZE = 500;
  const TOTAL_PLANTS = 5000;

  for (let i = 0; i < TOTAL_PLANTS; i += BATCH_SIZE) {
    const batch = [];
    const batchEnd = Math.min(i + BATCH_SIZE, TOTAL_PLANTS);

    for (let j = i; j < batchEnd; j++) {
      const regDate = generateRegDate();
      batch.push({
        recNum: 1000 + j,
        name: generatePlantName(j),
        hybridizer: pick(hybridizers),
        habit: pickWeighted(habits),
        regNum: String(50000 + j),
        regDate,
        blossom: generateBlossom(),
        foliage: generateFoliage(),
        vintage: regDate.substring(0, 4),
        isInCatalog: true
      });
    }

    await prisma.plant.createMany({ data: batch });
    process.stdout.write(`\r  Inserted ${batchEnd} / ${TOTAL_PLANTS} plants`);
  }

  console.log('\n  ✓ Created 5,000 test plants\n');
}

// ============================================
// STEP 4: CREATE COLOR TAGS
// ============================================

const COLOR_FAMILIES = {
  pink: { displayName: 'Pink', color: '#FF69B4', keywords: ['pink', 'coral', 'salmon', 'blush', 'rose'], sortOrder: 1 },
  red: { displayName: 'Red', color: '#DC143C', keywords: ['red', 'burgundy', 'raspberry', 'cherry', 'ruby', 'scarlet', 'cranberry', 'wine', 'crimson'], sortOrder: 2 },
  purple: { displayName: 'Purple', color: '#8B008B', keywords: ['purple', 'plum', 'grape', 'violet', 'magenta', 'fuchsia', 'orchid'], sortOrder: 3 },
  lavender: { displayName: 'Lavender', color: '#E6E6FA', keywords: ['lavender', 'lilac', 'mauve', 'periwinkle'], sortOrder: 4 },
  blue: { displayName: 'Blue', color: '#4169E1', keywords: ['blue', 'cobalt', 'navy', 'azure', 'sapphire', 'sky'], sortOrder: 5 },
  white: { displayName: 'White', color: '#FFFFFF', keywords: ['white', 'cream', 'ivory', 'snow'], sortOrder: 6 },
  yellow: { displayName: 'Yellow', color: '#FFD700', keywords: ['yellow', 'gold', 'lemon', 'butter', 'canary'], sortOrder: 7 },
  green: { displayName: 'Green', color: '#228B22', keywords: ['green', 'lime', 'chartreuse', 'mint', 'emerald'], sortOrder: 8 },
  multicolor: { displayName: 'Multicolor', color: '#FF00FF', keywords: ['fantasy', 'chimera', 'pinwheel', 'stripe', 'splash'], sortOrder: 9 },
};

function buildColorRegex(keywords) {
  const pattern = keywords.map(k => `\\b${k}\\b`).join('|');
  return new RegExp(pattern, 'i');
}

function detectColors(blossomText) {
  if (!blossomText) return [];
  const matches = [];
  for (const [colorName, config] of Object.entries(COLOR_FAMILIES)) {
    const regex = buildColorRegex(config.keywords);
    if (regex.test(blossomText)) matches.push(colorName);
  }
  return matches;
}

async function generateColorTags() {
  console.log('Step 3/6: Creating color tags...');

  // Create tags
  const tags = [];
  for (const [name, config] of Object.entries(COLOR_FAMILIES)) {
    const tag = await prisma.tag.upsert({
      where: { category_name: { category: 'color', name } },
      update: { displayName: config.displayName, color: config.color, sortOrder: config.sortOrder },
      create: { category: 'color', name, displayName: config.displayName, color: config.color, sortOrder: config.sortOrder },
    });
    tags.push(tag);
  }
  console.log('  ✓ Created 9 color tags');

  // Build tag name -> id map
  const tagMap = {};
  for (const tag of tags) tagMap[tag.name] = tag.id;

  // Tag all plants
  const plants = await prisma.plant.findMany({
    where: { blossom: { not: null } },
    select: { id: true, blossom: true },
  });

  let plantsTagged = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < plants.length; i += BATCH_SIZE) {
    const batch = plants.slice(i, i + BATCH_SIZE);
    const plantTagsToCreate = [];

    for (const plant of batch) {
      const colors = detectColors(plant.blossom);
      if (colors.length > 0) {
        plantsTagged++;
        for (const colorName of colors) {
          plantTagsToCreate.push({
            plantId: plant.id,
            tagId: tagMap[colorName],
            source: 'auto',
            confidence: 1.0,
          });
        }
      }
    }

    if (plantTagsToCreate.length > 0) {
      await prisma.plantTag.createMany({ data: plantTagsToCreate, skipDuplicates: true });
    }
  }

  console.log(`  ✓ Tagged ${plantsTagged} plants by color\n`);
}

// ============================================
// STEP 5: COMPUTE DESCRIPTIONS
// ============================================

async function computeDescriptions() {
  console.log('Step 4/6: Computing descriptions...');

  const plants = await prisma.plant.findMany({ orderBy: { id: 'asc' } });
  let updated = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < plants.length; i += BATCH_SIZE) {
    const batch = plants.slice(i, i + BATCH_SIZE);

    for (const plant of batch) {
      const description = generateDescription(plant);
      if (plant.description !== description) {
        await prisma.plant.update({
          where: { id: plant.id },
          data: { description }
        });
        updated++;
      }
    }

    process.stdout.write(`\r  Processed ${Math.min(i + BATCH_SIZE, plants.length)} / ${plants.length}`);
  }

  console.log(`\n  ✓ Updated ${updated} plant descriptions\n`);
}

// ============================================
// STEP 6: GENERATE TEST USERS
// ============================================

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function selectPlantsForUser(popular, common, uncommon, rare) {
  const selected = [];
  popular.forEach(p => { if (Math.random() < 0.40) selected.push(p.id); });
  common.forEach(p => { if (Math.random() < 0.20) selected.push(p.id); });
  uncommon.forEach(p => { if (Math.random() < 0.05) selected.push(p.id); });
  rare.forEach(p => { if (Math.random() < 0.005) selected.push(p.id); });
  return selected;
}

async function generateTestUsers() {
  console.log('Step 5/6: Creating test users...');

  const TOTAL_USERS = 75;

  // Get all catalog plants
  const allPlants = await prisma.plant.findMany({
    where: { isInCatalog: true },
    select: { id: true }
  });

  // Shuffle and assign to popularity tiers
  const shuffled = shuffle(allPlants);
  const popularCount = Math.floor(allPlants.length * 0.10);
  const commonCount = Math.floor(allPlants.length * 0.25);
  const uncommonCount = Math.floor(allPlants.length * 0.40);

  const popular = shuffled.slice(0, popularCount);
  const common = shuffled.slice(popularCount, popularCount + commonCount);
  const uncommon = shuffled.slice(popularCount + commonCount, popularCount + commonCount + uncommonCount);
  const rare = shuffled.slice(popularCount + commonCount + uncommonCount);

  let totalPlantsAdded = 0;

  for (let i = 0; i < TOTAL_USERS; i++) {
    const userId = `test-user-${i.toString().padStart(4, '0')}`;

    const user = await prisma.user.create({
      data: {
        id: userId,
        name: `Test User ${i + 1}`,
        email: `testuser${i}@example.com`,
        emailVerified: true,
      }
    });

    // Create their lists
    const collection = await prisma.list.create({
      data: { userId: user.id, name: 'My Collection', isDefault: true }
    });

    await prisma.list.create({
      data: { userId: user.id, name: 'Wishlist', isDefault: true }
    });

    // Add plants based on probability distribution
    const userPlants = selectPlantsForUser(popular, common, uncommon, rare);
    totalPlantsAdded += userPlants.length;

    if (userPlants.length > 0) {
      await prisma.listPlant.createMany({
        data: userPlants.map(plantId => ({
          listId: collection.id,
          plantId,
          dateAdded: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        }))
      });
    }

    process.stdout.write(`\r  Created user ${i + 1}/${TOTAL_USERS}`);
  }

  console.log(`\n  ✓ Created ${TOTAL_USERS} test users with ${totalPlantsAdded} collection entries\n`);
}

// ============================================
// STEP 7: RECALCULATE POPULARITY
// ============================================

async function recalculatePopularity() {
  console.log('Step 6/6: Calculating popularity...');

  const counts = await prisma.$queryRaw`
    SELECT
      p.id,
      COALESCE(COUNT(DISTINCT l."userId"), 0)::int as "userCount"
    FROM "Plant" p
    LEFT JOIN "ListPlant" lp ON p.id = lp."plantId"
    LEFT JOIN "List" l ON lp."listId" = l.id AND l.name = 'My Collection'
    GROUP BY p.id
  `;

  for (const { id, userCount } of counts) {
    await prisma.plant.update({
      where: { id },
      data: { collectionCount: userCount }
    });
  }

  console.log(`  ✓ Updated collection counts for ${counts.length} plants\n`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🌸 Violetteer Data Generator');
  console.log('============================\n');

  const startTime = Date.now();

  await clearData();
  await seedFoundation();
  await generateTestPlants();
  await generateColorTags();
  await computeDescriptions();
  await generateTestUsers();
  await recalculatePopularity();

  // Print summary
  const plantCount = await prisma.plant.count();
  const userCount = await prisma.user.count();
  const listCount = await prisma.list.count();
  const listPlantCount = await prisma.listPlant.count();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('============================');
  console.log(`✅ Done in ${elapsed}s! Database now contains:`);
  console.log(`   Plants: ${plantCount.toLocaleString()}`);
  console.log(`   Users: ${userCount}`);
  console.log(`   Lists: ${listCount}`);
  console.log(`   Collection entries: ${listPlantCount.toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
