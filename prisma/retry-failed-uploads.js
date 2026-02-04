/**
 * retry-failed-uploads.js - Retry failed catalog photo uploads
 *
 * Identifies plants that are missing from photo-mapping-spaces.json
 * and uploads them to DO Spaces.
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
 * Upload a processed image to DO Spaces
 */
async function uploadProcessed(buffer, key, options = {}) {
  const { width, height, fit = 'cover', quality = 80 } = options;

  let processed = sharp(buffer);
  if (width || height) {
    processed = processed.resize({ width, height, fit });
  }
  processed = processed.webp({ quality });

  const optimizedBuffer = await processed.toBuffer();

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

async function main() {
  console.log('🔄 Retrying Failed Catalog Photo Uploads\n');

  // Read all photo files
  const files = fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith('.jpg'));

  // Group photos by recNum
  const photosByRecNum = {};
  for (const file of files) {
    const match = file.match(/^(\d+)([a-z])\.jpg$/i);
    if (!match) continue;
    const recNum = parseInt(match[1]);
    const letter = match[2].toLowerCase();
    if (!photosByRecNum[recNum]) photosByRecNum[recNum] = [];
    photosByRecNum[recNum].push({
      letter,
      filename: file,
      path: path.join(PHOTOS_DIR, file)
    });
  }

  // Load existing mapping
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8'));
  const mappedRecNums = new Set(Object.keys(mapping).map(Number));

  // Find missing recNums
  const allRecNums = Object.keys(photosByRecNum).map(Number);
  const missing = allRecNums.filter(r => !mappedRecNums.has(r)).sort((a, b) => a - b);

  console.log(`Total plants with photos: ${allRecNums.length}`);
  console.log(`Already uploaded: ${mappedRecNums.size}`);
  console.log(`Missing (to retry): ${missing.length}\n`);

  if (missing.length === 0) {
    console.log('✅ Nothing to retry - all photos uploaded!');
    return;
  }

  console.log(`Missing recNums: ${missing.join(', ')}\n`);
  console.log('Uploading...\n');

  let uploaded = 0;
  let failed = 0;
  const failedPlants = [];

  for (let i = 0; i < missing.length; i++) {
    const recNum = missing[i];
    const photos = photosByRecNum[recNum]
      .sort((a, b) => a.letter.localeCompare(b.letter))
      .slice(0, 5); // Max 5 photos per plant

    const urls = { main: [], thumb: [] };
    let plantFailed = false;

    for (const photo of photos) {
      try {
        const buffer = fs.readFileSync(photo.path);
        const baseKey = `catalog/${recNum}-${photo.letter}`;

        const mainUrl = await uploadProcessed(buffer, `${baseKey}-main.webp`, {
          width: 1024,
          height: null,
          fit: 'inside',
          quality: 80,
        });

        const thumbUrl = await uploadProcessed(buffer, `${baseKey}-thumb.webp`, {
          width: 300,
          height: 300,
          fit: 'cover',
          quality: 70,
        });

        urls.main.push(mainUrl);
        urls.thumb.push(thumbUrl);
        uploaded++;
      } catch (error) {
        console.error(`  ✗ Failed ${recNum}-${photo.letter}: ${error.message}`);
        failed++;
        plantFailed = true;
      }
    }

    if (urls.main.length > 0) {
      mapping[recNum] = urls;
    }

    if (plantFailed) {
      failedPlants.push(recNum);
    }

    // Progress
    const progress = Math.round(((i + 1) / missing.length) * 100);
    process.stdout.write(`\r  Progress: ${i + 1}/${missing.length} (${progress}%) - Uploaded: ${uploaded}, Failed: ${failed}`);

    // Save periodically
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    }
  }

  console.log('\n');

  // Final save
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  console.log(`✓ Saved mapping to ${MAPPING_FILE}\n`);

  // Update database with new photo URLs
  console.log('Updating database records...\n');
  let dbUpdated = 0;

  for (const recNum of missing) {
    const urls = mapping[recNum];
    if (!urls || !urls.main || urls.main.length === 0) continue;

    try {
      await prisma.plant.updateMany({
        where: { recNum },
        data: {
          imageUrl: urls.main[0],
          thumbnailUrl: urls.thumb[0],
          featuredPhotos: urls.main,
        },
      });
      dbUpdated++;
    } catch (error) {
      // Plant might not exist in database
    }
  }

  console.log(`✓ Updated ${dbUpdated} plants in database\n`);

  // Summary
  console.log('=================================================');
  console.log(`✅ Retry complete!`);
  console.log(`   Photos uploaded: ${uploaded}`);
  console.log(`   Photos failed: ${failed}`);
  if (failedPlants.length > 0) {
    console.log(`   Still failing: ${failedPlants.join(', ')}`);
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
