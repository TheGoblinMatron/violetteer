/**
 * import-firstclass-data.js - Import Real AVSA Data from FirstClass
 *
 * Imports the complete African Violet Society of America (AVSA) registry
 * from the FirstClass SQLite database into Violetteer's PostgreSQL database.
 *
 * SOURCE DATA:
 *   Database: /Users/sara/Documents/FirstClass/avml.db
 *   Photos:   /Users/sara/Documents/FirstClass/Photos/ (10,223 files)
 *
 * This script imports plants only (no photos). Photos can be uploaded
 * separately using upload-catalog-photos.js (to be created).
 *
 * Usage:
 *   npm run import-real-data
 *
 * LEARNING NOTES:
 *   - SQLite is a file-based database (single .db file)
 *   - We use better-sqlite3 to read it synchronously (simpler than async)
 *   - Data cleaning is important: handling nulls, special chars, date formats
 *   - Batch inserts (500 at a time) are much faster than individual inserts
 */

import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import fs from 'fs';
import { generateDescription } from '../server/lib/plantDescription.js';

// ============================================================
// STALE-SCHEMA GUARD (2026-06-08)
// This script writes ListPlant rows directly with plantId.
// Broken after the 20260307201829_add_user_plant migration.
// Update before use: see prisma/seed.js for the new pattern.
// Short version: create one UserPlant per (userId, catalogPlantId),
// then ListPlant with userPlantId. Raw SQL: Plant -> UserPlant
// -> ListPlant -> List. Add userPlant.deleteMany() to cleanup.
// ============================================================
console.error('[stale-schema] prisma/import-firstclass-data.js targets the pre-UserPlant schema and must be updated before use. See header comment.');
process.exit(1);

const prisma = new PrismaClient();

// Path to FirstClass data
const FIRSTCLASS_DB_PATH = '/Users/sara/Documents/FirstClass/avml.db';
// Photo mapping file - prefer Spaces version, fall back to old Cloudinary version
const SPACES_MAPPING_FILE = '/Users/sara/Documents/FirstClass/photo-mapping-spaces.json';
const CLOUDINARY_MAPPING_FILE = '/Users/sara/Documents/FirstClass/photo-mapping.json';

// ============================================
// HABIT TYPE MAPPING
// FirstClass stores habit as an integer code
// ============================================

const habitMap = {
  0: null,            // Unknown
  1: 'Standard',
  2: 'Semiminiature',
  3: 'Miniature',
  4: 'Large',
  5: 'Small Standard',
  6: 'Trailer',
  7: 'Standard Trailer',
  8: 'Semiminiature Trailer',
  9: 'Miniature Trailer',
  10: 'Saintpaulia species',
  32: null            // Invalid/unknown
};

// ============================================
// DATA CLEANING FUNCTIONS
// ============================================

/**
 * Clean a string field from the database
 * - Convert empty strings to null
 * - Trim whitespace
 * - Replace ~ with , in foliage descriptions
 * - Replace ^ with ' in names (FirstClass encoding quirk)
 */
function cleanString(value, options = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  let cleaned = String(value).trim();
  if (cleaned === '') return null;

  // Replace ~ with , (used in foliage descriptions)
  if (options.replaceWavy) {
    cleaned = cleaned.replace(/~/g, ',');
  }

  // Replace ^ with ' (used in names like "Abie^s Irish Rose" -> "Abie's Irish Rose")
  if (options.replaceCaret) {
    cleaned = cleaned.replace(/\^/g, "'");
  }

  return cleaned;
}

/**
 * Clean vintage/year field
 * Some records have odd values like "5" instead of full year
 */
function cleanVintage(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '' || str === '0') return null;
  // If it's a single digit, it's likely invalid
  if (str.length === 1) return null;
  return str;
}

/**
 * Load photo mapping from previous upload (if exists)
 * This allows re-importing plant data without re-uploading photos.
 *
 * Supports two formats:
 * - New Spaces format: { recNum: { main: [urls], thumb: [urls] } }
 * - Old Cloudinary format: { recNum: [urls] }
 */
function loadPhotoMapping() {
  // Prefer Spaces mapping if it exists
  if (fs.existsSync(SPACES_MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(SPACES_MAPPING_FILE, 'utf-8');
      const mapping = JSON.parse(data);
      console.log(`  ✓ Using Spaces photo mapping (${Object.keys(mapping).length} plants)`);
      return { mapping, format: 'spaces' };
    } catch (error) {
      console.warn('Warning: Could not parse Spaces mapping file');
    }
  }

  // Fall back to old Cloudinary mapping
  if (fs.existsSync(CLOUDINARY_MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(CLOUDINARY_MAPPING_FILE, 'utf-8');
      const mapping = JSON.parse(data);
      console.log(`  ✓ Using Cloudinary photo mapping (${Object.keys(mapping).length} plants)`);
      return { mapping, format: 'cloudinary' };
    } catch (error) {
      console.warn('Warning: Could not parse Cloudinary mapping file');
    }
  }

  return { mapping: {}, format: null };
}

// Load photo mapping at startup
const { mapping: photoMapping, format: mappingFormat } = loadPhotoMapping();

/**
 * Get photo URLs for a plant from the mapping
 * Handles both Spaces format { main: [], thumb: [] } and Cloudinary format [urls]
 */
function getPhotoUrls(recNum) {
  const entry = photoMapping[recNum];
  if (!entry) return { imageUrl: null, thumbnailUrl: null, featuredPhotos: [] };

  if (mappingFormat === 'spaces') {
    // New format: { main: [urls], thumb: [urls] }
    return {
      imageUrl: entry.main?.[0] || null,
      thumbnailUrl: entry.thumb?.[0] || null,
      featuredPhotos: entry.main || [],
    };
  } else {
    // Old format: [urls] (Cloudinary)
    return {
      imageUrl: entry[0] || null,
      thumbnailUrl: null,  // No thumbnails in old format
      featuredPhotos: entry || [],
    };
  }
}

/**
 * Transform a FirstClass record into Violetteer Plant format
 */
function transformPlant(row) {
  // Get photo URLs from mapping if they exist
  const photos = getPhotoUrls(row.RecNum);

  return {
    recNum: row.RecNum,
    name: cleanString(row.Name, { replaceCaret: true }) || `Unknown #${row.RecNum}`,
    hybridizer: cleanString(row.Hybridizer, { replaceCaret: true }),
    habit: habitMap[row.Type] || null,
    regNum: row.RegNum ? String(row.RegNum) : null,
    regDate: cleanString(row.RegDate),
    blossom: cleanString(row.Blossom),
    foliage: cleanString(row.Foliage, { replaceWavy: true }),  // Replace ~ with ,
    altReg: cleanString(row.AltReg),
    vintage: cleanVintage(row.Vintage),
    engTrans: cleanString(row.EngTrans, { replaceCaret: true }),
    alias: cleanString(row.Alias, { replaceCaret: true }),
    lineage: cleanString(row.Lineage),
    isInCatalog: true,
    imageUrl: photos.imageUrl,
    thumbnailUrl: photos.thumbnailUrl,
    featuredPhotos: photos.featuredPhotos,
  };
}

// ============================================
// COLOR TAG GENERATION (same as generate-all-data.js)
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
  console.log('Creating color tags...');

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

  console.log(`  ✓ Tagged ${plantsTagged.toLocaleString()} plants by color\n`);
}

// ============================================
// MAIN IMPORT LOGIC
// ============================================

async function clearData() {
  console.log('Clearing existing data...');

  // Delete in reverse dependency order
  await prisma.plantTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.review.deleteMany();
  await prisma.plantPhoto.deleteMany();
  await prisma.listPlant.deleteMany();
  await prisma.list.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  console.log('  ✓ Cleared plants, tags, users, lists\n');
}

async function importPlants() {
  console.log('Opening FirstClass database...');

  // Open SQLite database (synchronous API - simpler to use)
  const db = new Database(FIRSTCLASS_DB_PATH, { readonly: true });

  // Count total plants
  const countResult = db.prepare('SELECT COUNT(*) as count FROM ml').get();
  const totalPlants = countResult.count;
  console.log(`  ✓ Found ${totalPlants.toLocaleString()} plants in avml.db`);

  // Report photo mapping status
  const photoMappingCount = Object.keys(photoMapping).length;
  if (photoMappingCount > 0) {
    console.log(`  ✓ Found photo mapping for ${photoMappingCount.toLocaleString()} plants`);
  }
  console.log('');

  console.log('Importing plants...');

  // Fetch all plants
  const rows = db.prepare('SELECT * FROM ml ORDER BY RecNum').all();

  // Batch insert
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const plantData = batch.map(transformPlant);

    await prisma.plant.createMany({ data: plantData });

    inserted += batch.length;
    process.stdout.write(`\r  Inserted ${inserted.toLocaleString()} / ${totalPlants.toLocaleString()}`);
  }

  db.close();
  console.log(`\n  ✓ Imported ${totalPlants.toLocaleString()} plants\n`);

  return totalPlants;
}

async function computeDescriptions() {
  console.log('Computing descriptions...');

  const plants = await prisma.plant.findMany({ orderBy: { id: 'asc' } });
  let updated = 0;

  const BATCH_SIZE = 500;
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

    process.stdout.write(`\r  Processed ${Math.min(i + BATCH_SIZE, plants.length).toLocaleString()} / ${plants.length.toLocaleString()}`);
  }

  console.log(`\n  ✓ Updated ${updated.toLocaleString()} plant descriptions\n`);
}

async function createDemoUser() {
  console.log('Creating demo user...');

  const demoUser = await prisma.user.create({
    data: {
      id: 'demo-user-001',
      email: 'demo@violetteer.com',
      name: 'Demo User',
      emailVerified: true,
      isAdmin: true,
    }
  });

  await prisma.list.create({
    data: {
      userId: demoUser.id,
      name: 'My Collection',
      description: 'Plants I own',
      color: '#4caf50',
      isDefault: true,
      isPublic: false
    }
  });

  await prisma.list.create({
    data: {
      userId: demoUser.id,
      name: 'Wishlist',
      description: 'Plants I want to acquire',
      color: '#2196f3',
      isDefault: true,
      isPublic: false
    }
  });

  console.log('  ✓ Created demo user (demo@violetteer.com)');
  console.log('  ✓ Created default lists\n');
}

// ============================================
// TEST USER GENERATION
// Same logic as generate-all-data.js for realistic collections
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
  console.log('Creating test users...');

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

  console.log(`\n  ✓ Created ${TOTAL_USERS} test users with ${totalPlantsAdded.toLocaleString()} collection entries\n`);
  return totalPlantsAdded;
}

async function recalculatePopularity() {
  console.log('Calculating popularity...');

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

  console.log(`  ✓ Updated collection counts for ${counts.length.toLocaleString()} plants\n`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🌸 Violetteer FirstClass Data Import');
  console.log('=====================================\n');

  const startTime = Date.now();

  await clearData();
  const plantCount = await importPlants();
  await generateColorTags();
  await computeDescriptions();
  await createDemoUser();
  await generateTestUsers();
  await recalculatePopularity();

  // Final stats
  const tagCount = await prisma.tag.count();
  const userCount = await prisma.user.count();
  const listCount = await prisma.list.count();
  const listPlantCount = await prisma.listPlant.count();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Count plants with photos
  const plantsWithPhotos = await prisma.plant.count({
    where: { imageUrl: { not: null } }
  });

  console.log('=====================================');
  console.log(`✅ Done in ${elapsed}s! Database now contains:`);
  console.log(`   Plants: ${plantCount.toLocaleString()}`);
  console.log(`   Plants with photos: ${plantsWithPhotos.toLocaleString()}`);
  console.log(`   Users: ${userCount}`);
  console.log(`   Lists: ${listCount}`);
  console.log(`   Collection entries: ${listPlantCount.toLocaleString()}`);
  console.log(`   Color tags: ${tagCount}`);
  console.log('');

  if (plantsWithPhotos === 0) {
    console.log(`📷 Photos not imported. Run 'npm run upload-catalog-photos'`);
    console.log(`   to upload photos to DO Spaces (takes 1-2 hours for 10K photos).`);
  } else {
    console.log(`📷 Restored ${plantsWithPhotos.toLocaleString()} plant photos from mapping file.`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
