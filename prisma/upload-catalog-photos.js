/**
 * upload-catalog-photos.js - Upload FirstClass Photos to DO Spaces
 *
 * Uploads all photos from the FirstClass Photos folder to Digital Ocean Spaces,
 * creating main (1024px) and thumbnail (300x300) versions for each.
 *
 * PHOTO MAPPING:
 *   - Photos are named like: {recNum}{letter}.jpg (e.g., 10003b.jpg, 10003c.jpg)
 *   - First photo (usually 'b') becomes Plant.imageUrl / Plant.thumbnailUrl
 *   - All main photos (up to 5) go into Plant.featuredPhotos array
 *
 * DO SPACES STRUCTURE:
 *   catalog/{recNum}-{letter}-main.jpg   (1024px max width)
 *   catalog/{recNum}-{letter}-thumb.jpg  (300x300 square)
 *
 * MAPPING FILE:
 *   Saves to /Users/sara/Documents/FirstClass/photo-mapping-spaces.json
 *   This file is read by import-firstclass-data.js on subsequent runs
 *   to avoid re-uploading photos.
 *
 * Usage:
 *   npm run upload-catalog-photos
 *
 * Options:
 *   --dry-run     Show what would be uploaded without actually uploading
 *   --limit=N     Only upload first N plants (for testing)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Paths
const PHOTOS_DIR = '/Users/sara/Documents/FirstClass/Photos';
const MAPPING_FILE = '/Users/sara/Documents/FirstClass/photo-mapping-spaces.json';

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
 * Parse a photo filename into recNum and letter
 * e.g., "10003b.jpg" -> { recNum: 10003, letter: 'b' }
 */
function parsePhotoFilename(filename) {
  const match = filename.match(/^(\d+)([a-z])\.jpg$/i);
  if (!match) return null;
  return {
    recNum: parseInt(match[1]),
    letter: match[2].toLowerCase(),
  };
}

/**
 * Upload a processed image to DO Spaces
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
 * Upload a single photo with both main and thumbnail versions
 */
async function uploadPhoto(filePath, recNum, letter) {
  const baseKey = `catalog/${recNum}-${letter}`;

  try {
    const buffer = fs.readFileSync(filePath);

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

    return { main: mainUrl, thumb: thumbUrl };
  } catch (error) {
    console.error(`  ✗ Failed to upload ${recNum}-${letter}: ${error.message}`);
    return null;
  }
}

/**
 * Load existing mapping file if it exists
 */
function loadExistingMapping() {
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(MAPPING_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Warning: Could not parse existing mapping file, starting fresh');
    }
  }
  return {};
}

/**
 * Save mapping to file
 */
function saveMapping(mapping) {
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
}

/**
 * Main upload function
 */
async function main() {
  console.log('📷 Violetteer Catalog Photo Uploader (DO Spaces)');
  console.log('=================================================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No uploads will be made\n');
  }

  // Check DO Spaces config
  if (!process.env.DO_SPACES_BUCKET && !DRY_RUN) {
    console.error('Error: DO_SPACES_BUCKET not set. Run with --dry-run or set environment variables.');
    process.exit(1);
  }

  // Load existing mapping
  const mapping = loadExistingMapping();
  const existingCount = Object.keys(mapping).length;
  if (existingCount > 0) {
    console.log(`Found existing mapping with ${existingCount} plants\n`);
  }

  // Read all photo files
  const files = fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith('.jpg'));
  console.log(`Found ${files.length.toLocaleString()} photos in ${PHOTOS_DIR}\n`);

  // Group photos by recNum
  const photosByRecNum = {};
  for (const file of files) {
    const parsed = parsePhotoFilename(file);
    if (!parsed) continue;

    if (!photosByRecNum[parsed.recNum]) {
      photosByRecNum[parsed.recNum] = [];
    }
    photosByRecNum[parsed.recNum].push({
      letter: parsed.letter,
      filename: file,
      path: path.join(PHOTOS_DIR, file),
    });
  }

  // Sort photos within each plant by letter
  for (const recNum of Object.keys(photosByRecNum)) {
    photosByRecNum[recNum].sort((a, b) => a.letter.localeCompare(b.letter));
  }

  const recNums = Object.keys(photosByRecNum).map(Number).sort((a, b) => a - b);
  console.log(`Photos belong to ${recNums.length.toLocaleString()} unique plants\n`);

  // Apply limit if specified
  const toProcess = LIMIT ? recNums.slice(0, LIMIT) : recNums;
  if (LIMIT) {
    console.log(`Limiting to first ${LIMIT} plants\n`);
  }

  // Upload photos
  console.log('Uploading photos to DO Spaces...\n');
  const startTime = Date.now();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const recNum = toProcess[i];
    const photos = photosByRecNum[recNum];

    // Skip if already in mapping with all photos
    if (mapping[recNum] && mapping[recNum].main?.length >= photos.length) {
      skipped++;
      continue;
    }

    // Upload each photo for this plant (max 5)
    const urls = { main: [], thumb: [] };
    for (const photo of photos.slice(0, 5)) {
      const result = await uploadPhoto(photo.path, recNum, photo.letter);
      if (result) {
        urls.main.push(result.main);
        urls.thumb.push(result.thumb);
        uploaded++;
      } else {
        failed++;
      }
    }

    // Save to mapping
    if (urls.main.length > 0) {
      mapping[recNum] = urls;
    }

    // Progress
    const progress = Math.round(((i + 1) / toProcess.length) * 100);
    process.stdout.write(`\r  Progress: ${i + 1}/${toProcess.length} plants (${progress}%) - Uploaded: ${uploaded}, Skipped: ${skipped}`);

    // Save mapping periodically (every 50 plants)
    if ((i + 1) % 50 === 0 && !DRY_RUN) {
      saveMapping(mapping);
    }
  }

  console.log('\n');

  // Final save
  if (!DRY_RUN) {
    saveMapping(mapping);
    console.log(`✓ Saved mapping to ${MAPPING_FILE}\n`);
  }

  // Update database with photo URLs
  if (!DRY_RUN) {
    console.log('Updating plant records with photo URLs...\n');

    let updated = 0;
    for (const recNum of Object.keys(mapping)) {
      const urls = mapping[recNum];
      if (!urls.main || urls.main.length === 0) continue;

      try {
        await prisma.plant.updateMany({
          where: { recNum: parseInt(recNum) },
          data: {
            imageUrl: urls.main[0],       // First main photo as primary
            thumbnailUrl: urls.thumb[0],  // First thumbnail
            featuredPhotos: urls.main,    // All main photos
          },
        });
        updated++;
      } catch (error) {
        // Plant might not exist in database yet
      }
    }

    console.log(`✓ Updated ${updated.toLocaleString()} plants with photo URLs\n`);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=================================================');
  console.log(`✅ Done in ${elapsed}s!`);
  console.log(`   Photos uploaded: ${uploaded.toLocaleString()}`);
  console.log(`   Plants skipped (already uploaded): ${skipped.toLocaleString()}`);
  console.log(`   Failed uploads: ${failed}`);
  console.log(`   Mapping file: ${MAPPING_FILE}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
