/**
 * migrate-to-spaces.js - Migrate Cloudinary photos to Digital Ocean Spaces
 *
 * This script:
 * 1. Reads the existing photo-mapping.json (Cloudinary URLs)
 * 2. Downloads each photo from Cloudinary
 * 3. Processes with Sharp into main (1024px) + thumbnail (300x300)
 * 4. Uploads both versions to DO Spaces
 * 5. Saves new mapping file with both URLs
 * 6. Updates database records
 *
 * Usage:
 *   npm run migrate-photos
 *   npm run migrate-photos -- --dry-run     # Preview without uploading
 *   npm run migrate-photos -- --limit=100   # Only migrate first 100 plants
 *
 * IMPORTANT: This can take several hours for 10K+ photos!
 * Progress is saved every 50 plants so you can resume if interrupted.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import fs from 'fs';

const prisma = new PrismaClient();

// File paths
const CLOUDINARY_MAPPING = '/Users/sara/Documents/FirstClass/photo-mapping.json';
const SPACES_MAPPING = '/Users/sara/Documents/FirstClass/photo-mapping-spaces.json';

// Parse command line args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// Initialize S3 client for DO Spaces
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY,
  },
});

/**
 * Upload a processed image to Spaces
 */
async function uploadProcessed(buffer, key, options = {}) {
  const { width, height, fit = 'cover', quality = 80 } = options;

  let processed = sharp(buffer);
  if (width || height) {
    processed = processed.resize({ width, height, fit });
  }
  // Convert to WebP for ~25-35% smaller files than JPEG
  processed = processed.webp({ quality });

  const optimizedBuffer = await processed.toBuffer();

  if (DRY_RUN) {
    return `${process.env.DO_SPACES_CDN_URL}/${key}`;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: key,
    Body: optimizedBuffer,
    ContentType: 'image/webp',
    ACL: 'public-read',
    CacheControl: 'max-age=31536000',
  }));

  return `${process.env.DO_SPACES_CDN_URL}/${key}`;
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${url} (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Load existing Spaces mapping (for resume support)
 */
function loadSpacesMapping() {
  if (fs.existsSync(SPACES_MAPPING)) {
    try {
      return JSON.parse(fs.readFileSync(SPACES_MAPPING, 'utf-8'));
    } catch (error) {
      console.warn('Warning: Could not parse existing Spaces mapping');
    }
  }
  return {};
}

async function migratePhotos() {
  console.log('🚀 Cloudinary to DO Spaces Migration');
  console.log('=====================================');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No uploads will be made\n');
  }

  // Load Cloudinary mapping
  if (!fs.existsSync(CLOUDINARY_MAPPING)) {
    console.error(`Error: Cloudinary mapping not found at ${CLOUDINARY_MAPPING}`);
    process.exit(1);
  }

  const cloudinaryMapping = JSON.parse(fs.readFileSync(CLOUDINARY_MAPPING, 'utf-8'));
  const spacesMapping = loadSpacesMapping();

  const recNums = Object.keys(cloudinaryMapping);
  const totalPlants = LIMIT ? Math.min(recNums.length, LIMIT) : recNums.length;

  console.log(`Found ${recNums.length} plants in Cloudinary mapping`);
  console.log(`Already migrated: ${Object.keys(spacesMapping).length} plants`);
  if (LIMIT) {
    console.log(`Limiting to first ${LIMIT} plants`);
  }
  console.log('');

  const startTime = Date.now();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const recNum of recNums) {
    // Check limit
    if (LIMIT && processed >= LIMIT) break;

    // Skip already migrated
    if (spacesMapping[recNum]) {
      skipped++;
      continue;
    }

    const cloudinaryUrls = cloudinaryMapping[recNum];
    const newUrls = { main: [], thumb: [] };

    for (const cloudinaryUrl of cloudinaryUrls) {
      // Extract letter from URL (e.g., "6-b" from ".../6-b.jpg")
      const match = cloudinaryUrl.match(/(\d+)-([a-z])\.jpg/i);
      if (!match) {
        console.warn(`  Warning: Could not parse URL ${cloudinaryUrl}`);
        continue;
      }
      const letter = match[2].toLowerCase();
      const baseKey = `catalog/${recNum}-${letter}`;

      try {
        if (!DRY_RUN) {
          // Download from Cloudinary
          const buffer = await downloadImage(cloudinaryUrl);

          // Upload main version (1024px max width)
          const mainUrl = await uploadProcessed(buffer, `${baseKey}-main.webp`, {
            width: 1024,
            height: null,
            fit: 'inside',
            quality: 80,
          });

          // Upload thumbnail (300x300)
          const thumbUrl = await uploadProcessed(buffer, `${baseKey}-thumb.webp`, {
            width: 300,
            height: 300,
            fit: 'cover',
            quality: 70,
          });

          newUrls.main.push(mainUrl);
          newUrls.thumb.push(thumbUrl);
        } else {
          // Dry run - just generate URLs
          newUrls.main.push(`${process.env.DO_SPACES_CDN_URL}/${baseKey}-main.jpg`);
          newUrls.thumb.push(`${process.env.DO_SPACES_CDN_URL}/${baseKey}-thumb.jpg`);
        }
      } catch (error) {
        console.error(`  Error processing ${cloudinaryUrl}: ${error.message}`);
        failed++;
      }
    }

    if (newUrls.main.length > 0) {
      spacesMapping[recNum] = newUrls;
    }

    processed++;

    // Progress update
    const pct = Math.round((processed / totalPlants) * 100);
    process.stdout.write(`\r  Progress: ${processed}/${totalPlants} (${pct}%) - Skipped: ${skipped}, Failed: ${failed}`);

    // Save progress every 50 plants
    if (processed % 50 === 0 && !DRY_RUN) {
      fs.writeFileSync(SPACES_MAPPING, JSON.stringify(spacesMapping, null, 2));
    }
  }

  console.log('\n');

  // Final save
  if (!DRY_RUN) {
    fs.writeFileSync(SPACES_MAPPING, JSON.stringify(spacesMapping, null, 2));
    console.log(`✓ Saved mapping to ${SPACES_MAPPING}`);
  }

  // Update database
  if (!DRY_RUN && Object.keys(spacesMapping).length > 0) {
    console.log('\nUpdating database records...');

    let dbUpdated = 0;
    for (const [recNum, urls] of Object.entries(spacesMapping)) {
      try {
        await prisma.plant.updateMany({
          where: { recNum: parseInt(recNum) },
          data: {
            imageUrl: urls.main[0] || null,
            thumbnailUrl: urls.thumb[0] || null,
            featuredPhotos: urls.main,
          }
        });
        dbUpdated++;

        if (dbUpdated % 500 === 0) {
          process.stdout.write(`\r  Updated ${dbUpdated} plants...`);
        }
      } catch (error) {
        console.error(`  Error updating plant ${recNum}: ${error.message}`);
      }
    }

    console.log(`\n✓ Updated ${dbUpdated} plants in database`);
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n=====================================');
  console.log(`✅ Migration ${DRY_RUN ? 'preview' : 'complete'} in ${elapsed} minutes`);
  console.log(`   Plants processed: ${processed}`);
  console.log(`   Plants skipped (already done): ${skipped}`);
  console.log(`   Errors: ${failed}`);
  console.log(`   Total in Spaces mapping: ${Object.keys(spacesMapping).length}`);
}

migratePhotos()
  .catch((e) => {
    console.error('\nMigration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
