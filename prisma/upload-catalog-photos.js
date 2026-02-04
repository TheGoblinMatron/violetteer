/**
 * upload-catalog-photos.js - Upload FirstClass Photos to Cloudinary
 *
 * Uploads all photos from the FirstClass Photos folder to Cloudinary,
 * then updates the Plant records with the URLs.
 *
 * PHOTO MAPPING:
 *   - Photos are named like: {recNum}{letter}.jpg (e.g., 10003b.jpg, 10003c.jpg)
 *   - First photo (usually 'b') becomes Plant.imageUrl
 *   - All photos (up to 5) go into Plant.featuredPhotos array
 *
 * CLOUDINARY STRUCTURE:
 *   violetteer/catalog/{recNum}-{letter}
 *   e.g., violetteer/catalog/10003-b, violetteer/catalog/10003-c
 *
 * MAPPING FILE:
 *   Saves to /Users/sara/Documents/FirstClass/photo-mapping.json
 *   This file is read by import-firstclass-data.js on subsequent runs
 *   to avoid re-uploading photos.
 *
 * Usage:
 *   npm run upload-catalog-photos
 *
 * Options:
 *   --dry-run     Show what would be uploaded without actually uploading
 *   --limit=N     Only upload first N photos (for testing)
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Paths
const PHOTOS_DIR = '/Users/sara/Documents/FirstClass/Photos';
const MAPPING_FILE = '/Users/sara/Documents/FirstClass/photo-mapping.json';

// Parse command line args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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
 * Upload a single photo to Cloudinary
 */
async function uploadPhoto(filePath, recNum, letter) {
  const publicId = `violetteer/catalog/${recNum}-${letter}`;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });
    return result.secure_url;
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
  console.log('📷 Violetteer Catalog Photo Uploader');
  console.log('=====================================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No uploads will be made\n');
  }

  // Check Cloudinary config
  if (!process.env.CLOUDINARY_CLOUD_NAME && !DRY_RUN) {
    console.error('Error: CLOUDINARY_CLOUD_NAME not set. Run with --dry-run or set environment variables.');
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
  console.log('Uploading photos to Cloudinary...\n');
  const startTime = Date.now();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const recNum = toProcess[i];
    const photos = photosByRecNum[recNum];

    // Skip if already in mapping with all photos
    if (mapping[recNum] && mapping[recNum].length >= photos.length) {
      skipped++;
      continue;
    }

    // Upload each photo for this plant (max 5)
    const urls = [];
    for (const photo of photos.slice(0, 5)) {
      if (DRY_RUN) {
        urls.push(`https://example.com/violetteer/catalog/${recNum}-${photo.letter}.jpg`);
        uploaded++;
      } else {
        const url = await uploadPhoto(photo.path, recNum, photo.letter);
        if (url) {
          urls.push(url);
          uploaded++;
        } else {
          failed++;
        }
      }
    }

    // Save to mapping
    if (urls.length > 0) {
      mapping[recNum] = urls;
    }

    // Progress
    const progress = Math.round(((i + 1) / toProcess.length) * 100);
    process.stdout.write(`\r  Progress: ${i + 1}/${toProcess.length} plants (${progress}%) - Uploaded: ${uploaded}, Skipped: ${skipped}`);

    // Save mapping periodically (every 100 plants)
    if ((i + 1) % 100 === 0 && !DRY_RUN) {
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
      if (urls.length === 0) continue;

      try {
        await prisma.plant.updateMany({
          where: { recNum: parseInt(recNum) },
          data: {
            imageUrl: urls[0],  // First photo as primary
            featuredPhotos: urls,  // All photos
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
  console.log('=====================================');
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
