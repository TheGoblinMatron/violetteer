#!/usr/bin/env node
/**
 * One-shot data migration: collapse Plant.imageUrl / featuredPhotos[]
 * into PlantPhoto rows with source='AVSA_SEEDED', set Plant.primaryPhotoId,
 * and backfill ~10K photographer credits from avml.db.
 *
 * Usage:
 *   node scripts/migrate-photos-to-plant-photo.js --dry-run
 *   node scripts/migrate-photos-to-plant-photo.js --avml-db "$HOME/Documents/FirstClass/avml.db"
 *
 * Idempotent: skips plants whose primaryPhotoId is already set.
 *
 * NOT meant to be re-run after Task 24 (drop_legacy_plant_photo_columns)
 * lands; preserved in the repo as a historical artifact.
 */
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const AVML_DB_ARG = argv.find(a => a.startsWith('--avml-db'));
// Supports both `--avml-db=PATH` and `--avml-db PATH`. Guards against the case
// where `--avml-db` is absent (indexOf returns -1, so we must not read argv[0]
// as a fallback — that picks up an unrelated arg like `--dry-run`).
let AVML_DB_PATH;
if (AVML_DB_ARG) {
  if (AVML_DB_ARG.includes('=')) {
    AVML_DB_PATH = AVML_DB_ARG.split('=')[1];
  } else {
    AVML_DB_PATH = argv[argv.indexOf('--avml-db') + 1];
  }
}

function log(msg) {
  console.log(`[migrate-photos] ${msg}`);
}

async function main() {
  log(DRY_RUN ? 'DRY RUN — no writes will occur' : 'LIVE RUN — writes enabled');

  // Counts that will be reported at the end
  const counts = {
    plantsScanned: 0,
    plantsSkippedAlreadyMigrated: 0,
    plantsSkippedNoPhotos: 0,
    photoRowsCreated: 0,
    primaryPhotoIdsSet: 0,
    creditsAttempted: 0,
    creditsMatched: 0,
    creditsUnmatched: [],
  };

  // Step A: migrate photo URLs (filled in Task 8)
  await migratePhotoUrls(counts);

  // Step B: backfill credits (filled in Task 9)
  if (AVML_DB_PATH) {
    await backfillCreditsFromAvmlDb(counts);
  } else {
    log('No --avml-db path given; skipping credits backfill.');
  }

  log('--- Summary ---');
  log(JSON.stringify(counts, null, 2));
}

async function migratePhotoUrls(counts) {
  // Stream plants in batches to avoid loading 19K rows at once
  const BATCH = 500;
  let cursor = 0;

  while (true) {
    const plants = await prisma.plant.findMany({
      where: { id: { gt: cursor } },
      select: {
        id: true,
        imageUrl: true,
        thumbnailUrl: true,
        featuredPhotos: true,
        primaryPhotoId: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
    });
    if (plants.length === 0) break;
    cursor = plants[plants.length - 1].id;

    for (const plant of plants) {
      counts.plantsScanned++;

      // Idempotency: skip if already migrated
      if (plant.primaryPhotoId !== null) {
        counts.plantsSkippedAlreadyMigrated++;
        continue;
      }

      // Build the URL list: primary (imageUrl) first, then any featuredPhotos
      // not equal to imageUrl (avoid duplicates).
      const urls = [];
      if (plant.imageUrl) urls.push({ url: plant.imageUrl, isPrimary: true });
      for (const featured of plant.featuredPhotos ?? []) {
        if (featured && featured !== plant.imageUrl) {
          urls.push({ url: featured, isPrimary: false });
        }
      }

      if (urls.length === 0) {
        counts.plantsSkippedNoPhotos++;
        continue;
      }

      if (DRY_RUN) {
        counts.photoRowsCreated += urls.length;
        if (urls.some(u => u.isPrimary)) counts.primaryPhotoIdsSet++;
        continue;
      }

      // Live: create rows in a transaction so primary FK stays consistent
      await prisma.$transaction(async (tx) => {
        let primaryId = null;
        for (const { url, isPrimary } of urls) {
          const created = await tx.plantPhoto.create({
            data: {
              plantId: plant.id,
              userId: null,
              imageUrl: url,
              thumbnailUrl: isPrimary ? plant.thumbnailUrl : null,
              source: 'AVSA_SEEDED',
              caption: null,
            },
            select: { id: true },
          });
          counts.photoRowsCreated++;
          if (isPrimary) primaryId = created.id;
        }
        if (primaryId !== null) {
          await tx.plant.update({
            where: { id: plant.id },
            data: { primaryPhotoId: primaryId },
          });
          counts.primaryPhotoIdsSet++;
        }
      });
    }

    log(`Processed ${counts.plantsScanned} plants...`);
  }
}

async function backfillCreditsFromAvmlDb(counts) {
  log(`Reading credits from ${AVML_DB_PATH}`);
  const sqlite = new Database(AVML_DB_PATH, { readonly: true });

  const rows = sqlite.prepare('SELECT PhotoID, Name FROM credits').all();
  sqlite.close();

  for (const { PhotoID, Name } of rows) {
    if (!PhotoID || !Name) continue;
    counts.creditsAttempted++;

    // PhotoID format: <RecNum><letter>, e.g., "10003b" — no separator.
    // Violetteer's stored image URLs use a different shape:
    //   https://violetteer-images.sfo3.cdn.digitaloceanspaces.com/catalog/<RecNum>-<letter>-main.webp
    // So we parse PhotoID into its parts and match the URL fragment.
    const m = PhotoID.match(/^(\d+)([a-z])$/);
    if (!m) {
      counts.creditsUnmatched.push({ PhotoID, Name, reason: 'malformed PhotoID' });
      continue;
    }
    const [, recNum, letter] = m;
    const matches = await prisma.plantPhoto.findMany({
      where: { imageUrl: { contains: `/${recNum}-${letter}-main` } },
      select: { id: true },
    });

    if (matches.length === 0) {
      counts.creditsUnmatched.push({ PhotoID, Name, reason: 'no matching PlantPhoto' });
      continue;
    }

    if (DRY_RUN) {
      counts.creditsMatched += matches.length;
      continue;
    }

    for (const photo of matches) {
      await prisma.plantPhoto.update({
        where: { id: photo.id },
        data: { photographerName: Name },
      });
      counts.creditsMatched++;
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
