# Photo Attribution + Admin Archive Uploads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify photo storage in a single `PlantPhoto` table with `source` discriminator + attribution columns, add an admin-only archive upload flow, and introduce forward-compatible auth helpers ready for future role expansion.

**Architecture:** Expand-then-contract schema migration in 4 ordered steps (additive Prisma migration → data backfill → frontend refactor → drop legacy columns). New `PlantPhoto.source` ('USER' | 'ARCHIVE' | 'AVSA_SEEDED') discriminator. New `Plant.primaryPhotoId` FK keeps catalog grid fast and sets up future cover-photo selection. Auth helpers module with resource-aware signatures, today reading `user.isAdmin`.

**Tech Stack:** Prisma (Postgres), Better Auth, Express, React, Material UI, DigitalOcean Spaces (existing upload pipeline via `server/lib/spaces.js`).

**Reference spec:** `docs/superpowers/specs/2026-06-08-photo-attribution-design.md`

**Testing note:** Violetteer has no automated test suite. This plan uses **manual verification scripts and curl smoke checks** in place of TDD red-green-refactor. When CI/Vitest lands (per the beta-readiness scorecard), these become Vitest + supertest cases trivially.

---

## File Structure

**New files:**
- `server/lib/photo-constants.js` — canonical PHOTO_SOURCES constants
- `server/lib/auth-helpers.js` — resource-aware authorization helpers
- `scripts/test-auth-helpers.mjs` — smoke verification for helpers (no test framework)
- `scripts/migrate-photos-to-plant-photo.js` — one-shot data migration
- `scripts/verify-photo-migration.js` — post-migration verification queries
- `src/components/admin/ArchiveUploadDialog.jsx` — admin-only attribution form
- Two Prisma migrations (auto-generated names): `add_photo_attribution`, `drop_legacy_plant_photo_columns`

**Modified files:**
- `prisma/schema.prisma` — schema additions then deletions (across two migrations)
- `prisma/seed.js` — produce new shape (PlantPhoto rows + primaryPhotoId)
- `server/middleware/auth.js` — `requireAdmin` body switches to `canCurateArchive` helper
- `server/index.js` — endpoints: photo upload + delete + new archive + new primary-photo + plant GET shape
- `src/components/PlantCard.jsx` — read `primaryPhoto.thumbnailUrl`
- `src/components/PlantDetail.jsx` — gallery + attribution badges + archive upload button
- `src/components/ListView.jsx` — read `primaryPhoto.thumbnailUrl`
- `src/components/PlantFormDialog.jsx` — required own-work affirmation checkbox

**Commit cadence:** one commit per task. Many tasks include a single logical change + verification + commit.

---

## Phase A — Foundation (constants, helpers, additive schema)

### Task 1: Add PHOTO_SOURCES constants

**Files:**
- Create: `server/lib/photo-constants.js`

- [ ] **Step 1: Create the constants module**

Write `server/lib/photo-constants.js`:

```js
/**
 * Canonical values for PlantPhoto.source.
 *
 * Using a frozen object + String column (not a Prisma enum) so that adding
 * a new value later (e.g., CC_COMMONS, PARTNER_FEED) doesn't require a
 * schema migration.
 */
export const PHOTO_SOURCES = Object.freeze({
  USER: 'USER',                  // User uploaded their own photo
  ARCHIVE: 'ARCHIVE',            // Admin uploaded historical/permissioned photo
  AVSA_SEEDED: 'AVSA_SEEDED',    // Original AVSA catalog photo (pre-Violetteer)
});
```

- [ ] **Step 2: Verify import works**

Run: `node -e "import('./server/lib/photo-constants.js').then(m => console.log(m.PHOTO_SOURCES))"`
Expected: `{ USER: 'USER', ARCHIVE: 'ARCHIVE', AVSA_SEEDED: 'AVSA_SEEDED' }`

- [ ] **Step 3: Commit**

```bash
git add server/lib/photo-constants.js
git commit -m "Add PHOTO_SOURCES constants module"
```

---

### Task 2: Add auth-helpers module

**Files:**
- Create: `server/lib/auth-helpers.js`

- [ ] **Step 1: Create the helpers module**

Write `server/lib/auth-helpers.js`:

```js
/**
 * Authorization helpers.
 *
 * Every authorization check in the API should go through one of these
 * functions. No route handler (or middleware) should read `user.isAdmin`
 * directly.
 *
 * Today: all bodies short-circuit on isAdmin. The signatures already
 * accept the resource being acted on, so future role-based logic (e.g.,
 * hybridizers can edit their own varieties) can be added by changing
 * function bodies alone — no callsite changes.
 */

/**
 * @param {{ isAdmin: boolean } | null | undefined} user
 * @returns {boolean}
 */
export function canCurateArchive(user) {
  return Boolean(user?.isAdmin);
}

/**
 * Catalog-plant edits include: editing fields, approving contributions,
 * managing tags. Today: admin only.
 *
 * Future: hybridizers can edit catalog plants where plant.hybridizer
 * matches user.verifiedHybridizerName.
 *
 * @param {{ isAdmin: boolean, verifiedHybridizerName?: string } | null} user
 * @param {{ hybridizer?: string | null }} plant
 */
export function canEditCatalogPlant(user, plant) {
  if (!user) return false;
  if (user.isAdmin) return true;
  // Future: hybridizer self-curation goes here.
  // if (user.verifiedHybridizerName && plant.hybridizer === user.verifiedHybridizerName) return true;
  return false;
}

/**
 * Setting the primary (cover) photo on a plant.
 * Today: admin only. Same future arc as canEditCatalogPlant.
 */
export function canSetCoverPhoto(user, plant) {
  return canEditCatalogPlant(user, plant);
}

/**
 * Deleting a photo. Rules:
 * - USER-source photos: only the uploader or an admin.
 * - ARCHIVE / AVSA_SEEDED photos: admin only.
 *
 * @param {{ id: string, isAdmin: boolean } | null} user
 * @param {{ userId: string | null, source: string }} photo
 */
export function canDeletePhoto(user, photo) {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (photo.source === 'USER' && photo.userId === user.id) return true;
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/lib/auth-helpers.js
git commit -m "Add auth-helpers module with resource-aware signatures"
```

---

### Task 3: Add smoke verification script for helpers

**Files:**
- Create: `scripts/test-auth-helpers.mjs`

- [ ] **Step 1: Write the smoke script**

Write `scripts/test-auth-helpers.mjs`:

```js
/**
 * Smoke verification for auth-helpers. Run with: node scripts/test-auth-helpers.mjs
 *
 * Replace with Vitest + supertest cases when test infrastructure lands.
 */
import assert from 'node:assert';
import {
  canCurateArchive,
  canEditCatalogPlant,
  canSetCoverPhoto,
  canDeletePhoto,
} from '../server/lib/auth-helpers.js';

const admin = { id: 'a1', isAdmin: true };
const regular = { id: 'u1', isAdmin: false };
const plant = { hybridizer: 'Optimara' };

// canCurateArchive
assert.strictEqual(canCurateArchive(admin), true);
assert.strictEqual(canCurateArchive(regular), false);
assert.strictEqual(canCurateArchive(null), false);
assert.strictEqual(canCurateArchive(undefined), false);

// canEditCatalogPlant
assert.strictEqual(canEditCatalogPlant(admin, plant), true);
assert.strictEqual(canEditCatalogPlant(regular, plant), false);
assert.strictEqual(canEditCatalogPlant(null, plant), false);

// canSetCoverPhoto delegates to canEditCatalogPlant
assert.strictEqual(canSetCoverPhoto(admin, plant), true);
assert.strictEqual(canSetCoverPhoto(regular, plant), false);

// canDeletePhoto
assert.strictEqual(canDeletePhoto(admin, { userId: 'someone', source: 'USER' }), true);
assert.strictEqual(canDeletePhoto(admin, { userId: null, source: 'ARCHIVE' }), true);
assert.strictEqual(canDeletePhoto(regular, { userId: 'u1', source: 'USER' }), true);
assert.strictEqual(canDeletePhoto(regular, { userId: 'someone-else', source: 'USER' }), false);
assert.strictEqual(canDeletePhoto(regular, { userId: null, source: 'ARCHIVE' }), false);
assert.strictEqual(canDeletePhoto(regular, { userId: null, source: 'AVSA_SEEDED' }), false);
assert.strictEqual(canDeletePhoto(null, { userId: 'u1', source: 'USER' }), false);

console.log('✓ All auth-helpers smoke checks passed.');
```

- [ ] **Step 2: Run the smoke script**

Run: `node scripts/test-auth-helpers.mjs`
Expected: `✓ All auth-helpers smoke checks passed.`

- [ ] **Step 3: Commit**

```bash
git add scripts/test-auth-helpers.mjs
git commit -m "Add smoke verification for auth-helpers"
```

---

### Task 4: Rewire requireAdmin middleware to use the helper

**Files:**
- Modify: `server/middleware/auth.js`

- [ ] **Step 1: Update the middleware to import + call canCurateArchive**

Currently `requireAdmin` reads `session.user.isAdmin` directly. Replace that one line so the helper becomes the single source of truth.

Edit `server/middleware/auth.js` — at the top of the file, add to existing imports:

```js
import { canCurateArchive } from '../lib/auth-helpers.js';
```

Then find this line inside `requireAdmin`:

```js
    if (!session.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
```

Replace with:

```js
    if (!canCurateArchive(session.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
```

- [ ] **Step 2: Verify the server still starts**

Run: `npm run dev` (or whichever script starts the server) — let it boot, hit `http://localhost:3001/api/users/me` once with curl as a sanity check (expect 401 if not authed). Stop the server.

```bash
curl -sS http://localhost:3001/api/users/me
```
Expected: `{"error":"Authentication required"}`

- [ ] **Step 3: Commit**

```bash
git add server/middleware/auth.js
git commit -m "Route requireAdmin through canCurateArchive helper"
```

---

### Task 5: Create additive Prisma migration (add_photo_attribution)

**Files:**
- Modify: `prisma/schema.prisma`
- Create (auto): `prisma/migrations/<timestamp>_add_photo_attribution/migration.sql`

- [ ] **Step 1: Edit the schema — Plant model**

In `prisma/schema.prisma`, in the `Plant` model, **leave existing imageUrl / thumbnailUrl / featuredPhotos in place** (additive migration; we drop them later in Task 24). Add `primaryPhotoId` and `primaryPhoto`, and rename the `userPhotos` relation to `photos` with a named relation tag:

Find:
```prisma
  userPlants            UserPlant[]   // Users who own an instance of this variety
  userPhotos            PlantPhoto[]
  reviews               Review[]
  plantTags             PlantTag[]
```

Replace with:
```prisma
  // Denormalized FK to the catalog-grid primary thumbnail.
  // Set on photo upload; nulls out if that photo is deleted.
  primaryPhotoId        Int?
  primaryPhoto          PlantPhoto? @relation("PlantPrimaryPhoto", fields: [primaryPhotoId], references: [id], onDelete: SetNull)

  userPlants            UserPlant[]
  photos                PlantPhoto[] @relation("PlantAllPhotos")
  reviews               Review[]
  plantTags             PlantTag[]
```

- [ ] **Step 2: Edit the schema — PlantPhoto model**

Find the existing PlantPhoto model. Add the three attribution columns and update the named relation. Replace the whole model block with:

```prisma
model PlantPhoto {
  id           Int      @id @default(autoincrement())
  plantId      Int
  userId       String?  // Who uploaded it (null for AVSA_SEEDED rows)
  imageUrl     String
  thumbnailUrl String?  // Required for primary photos (enforced by pipeline, not schema)
  caption      String?
  uploadedAt   DateTime @default(now())

  // Attribution + provenance
  source           String   @default("USER")  // 'USER' | 'ARCHIVE' | 'AVSA_SEEDED'
  photographerName String?
  attributionNote  String?

  plant       Plant    @relation("PlantAllPhotos", fields: [plantId], references: [id], onDelete: Cascade)
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  // Reverse side of the Plant.primaryPhoto FK
  primaryFor  Plant?   @relation("PlantPrimaryPhoto")

  @@index([plantId, source])
}
```

- [ ] **Step 3: Generate + apply the migration**

Run: `npx prisma migrate dev --name add_photo_attribution`
Expected: Prisma prompts/creates the migration, applies it, regenerates the client. No errors.

- [ ] **Step 4: Sanity check the generated SQL**

Run: `cat prisma/migrations/*add_photo_attribution*/migration.sql`
Expected: contains `ALTER TABLE "Plant" ADD COLUMN "primaryPhotoId"`, `ALTER TABLE "PlantPhoto" ADD COLUMN "source"`, `CREATE INDEX` on `(plantId, source)`, and a foreign key constraint `Plant_primaryPhotoId_fkey`.

- [ ] **Step 5: Verify the existing app still starts and renders the catalog**

Run: `npm run dev` and browse to `http://localhost:5173`. Confirm the catalog grid loads (it still reads `Plant.thumbnailUrl` — unchanged in this task). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add PlantPhoto attribution columns and Plant.primaryPhoto FK"
```

---

## Phase B — Data migration

### Task 6: Take pre-migration database backup

**Files:**
- (No file changes; creates a backup file outside the repo)

- [ ] **Step 1: Identify the local DB name**

Run: `grep DATABASE_URL .env`
Expected: a `postgresql://...` URL. Note the database name from it.

- [ ] **Step 2: Dump the database**

Run (substituting the DB name from Step 1):

```bash
pg_dump <DBNAME> | gzip > ~/violetteer-backup-2026-06-08-pre-photo-migration.sql.gz
ls -lh ~/violetteer-backup-2026-06-08-pre-photo-migration.sql.gz
```
Expected: a multi-MB `.sql.gz` file written. (Follows the same convention as the 2026-06-08 test-strip backup in `memory/reference_local_db_baseline.md`.)

- [ ] **Step 3: No commit (backup lives outside the repo)**

---

### Task 7: Scaffold the data migration script (dry-run only)

**Files:**
- Create: `scripts/migrate-photos-to-plant-photo.js`

- [ ] **Step 1: Write the scaffolding**

Write `scripts/migrate-photos-to-plant-photo.js`:

```js
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
  // Filled in Task 8
  log('migratePhotoUrls: TODO (filled in next task)');
}

async function backfillCreditsFromAvmlDb(counts) {
  // Filled in Task 10
  log('backfillCreditsFromAvmlDb: TODO (filled in next task)');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Confirm dependencies exist**

Run: `node -e "import('better-sqlite3').then(() => console.log('ok'))"`
Expected: `ok`. (`better-sqlite3` is in `package.json` per the install:safe rebuild list in `memory/feedback_npm_install_workflow.md`.)

- [ ] **Step 3: Run dry-run sanity check**

Run: `node scripts/migrate-photos-to-plant-photo.js --dry-run`
Expected output includes:
```
[migrate-photos] DRY RUN — no writes will occur
[migrate-photos] migratePhotoUrls: TODO (filled in next task)
[migrate-photos] No --avml-db path given; skipping credits backfill.
[migrate-photos] --- Summary ---
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-photos-to-plant-photo.js
git commit -m "Scaffold one-shot photo migration script (dry-run only)"
```

---

### Task 8: Implement photo-URL migration in the script

**Files:**
- Modify: `scripts/migrate-photos-to-plant-photo.js`

- [ ] **Step 1: Replace the `migratePhotoUrls` stub with the real implementation**

In `scripts/migrate-photos-to-plant-photo.js`, replace the stub body of `migratePhotoUrls` with:

```js
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
```

- [ ] **Step 2: Dry-run sanity check**

Run: `node scripts/migrate-photos-to-plant-photo.js --dry-run`
Expected: Summary shows `plantsScanned: ~19000+`, `photoRowsCreated: > 0`, `primaryPhotoIdsSet: > 0`. No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-photos-to-plant-photo.js
git commit -m "Implement photo-URL migration in migrate-photos script"
```

---

### Task 9: Implement credits backfill from avml.db

**Files:**
- Modify: `scripts/migrate-photos-to-plant-photo.js`

- [ ] **Step 1: Replace the `backfillCreditsFromAvmlDb` stub**

In `scripts/migrate-photos-to-plant-photo.js`, replace the stub body of `backfillCreditsFromAvmlDb` with:

```js
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
```

- [ ] **Step 2: Dry-run with the avml.db path**

Run:
```bash
node scripts/migrate-photos-to-plant-photo.js --dry-run --avml-db "$HOME/Documents/FirstClass/avml.db"
```
Expected: Summary shows `creditsAttempted: ~10341` (2 rows have empty PhotoID/Name and are skipped) and `creditsMatched` should be in the thousands (one match per credit row, matching against the AVSA_SEEDED PlantPhoto rows the script would have created in the same run). A small number of `creditsUnmatched` is expected (some credits refer to photos that aren't in the current catalog). No errors.

**Note on the dry-run match count:** Because the dry-run doesn't actually persist PlantPhoto rows during `migratePhotoUrls`, the credits backfill phase queries an empty `PlantPhoto` table and will report ~0 matches and ~10K unmatched. That's expected for `--dry-run`. The real match counts appear in the live run (Task 10).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-photos-to-plant-photo.js
git commit -m "Add avml.db credits backfill to migrate-photos script"
```

---

### Task 10: Run the migration live

**Files:**
- (No file changes; mutates the DB)

- [ ] **Step 1: Confirm backup exists**

Run: `ls -lh ~/violetteer-backup-2026-06-08-pre-photo-migration.sql.gz`
Expected: the file from Task 6 is present.

- [ ] **Step 2: Run live**

Run:
```bash
node scripts/migrate-photos-to-plant-photo.js --avml-db "$HOME/Documents/FirstClass/avml.db"
```
Expected: progress logs every 500 plants; final Summary with `plantsScanned ≈ 19113`, `photoRowsCreated > 0`, `primaryPhotoIdsSet > 0`, `creditsAttempted ≈ 10341`, `creditsMatched` in the thousands (one match per credit row that has a corresponding photo in the catalog). A modest `creditsUnmatched` count is expected (credits for photos that aren't in the current catalog — extinct or pre-rename varieties). No errors.

- [ ] **Step 3: Confirm via psql**

Run (substituting DB name):
```bash
psql <DBNAME> -c "SELECT source, COUNT(*) FROM \"PlantPhoto\" GROUP BY source;"
psql <DBNAME> -c "SELECT COUNT(*) AS plants_with_primary FROM \"Plant\" WHERE \"primaryPhotoId\" IS NOT NULL;"
psql <DBNAME> -c "SELECT COUNT(*) AS credited FROM \"PlantPhoto\" WHERE \"photographerName\" IS NOT NULL;"
psql <DBNAME> -c "SELECT \"photographerName\", COUNT(*) FROM \"PlantPhoto\" WHERE \"photographerName\" IS NOT NULL GROUP BY \"photographerName\" ORDER BY 2 DESC LIMIT 10;"
```
Expected:
- Row counts make sense (USER count = whatever existed pre-migration, AVSA_SEEDED count > 0).
- `plants_with_primary` matches `primaryPhotoIdsSet` from the run.
- `credited` is in the thousands (close to `creditsMatched` from the script's summary).
- Top photographers list should show recognizable names like Marjorie Bullard, AVSA, Joan Baker, etc. (a sanity check that the matching worked).

- [ ] **Step 4: No commit (no file changes)**

---

### Task 11: Add the verification script

**Files:**
- Create: `scripts/verify-photo-migration.js`

- [ ] **Step 1: Write the verification script**

Write `scripts/verify-photo-migration.js`:

```js
#!/usr/bin/env node
/**
 * Post-migration verification. Run AFTER migrate-photos-to-plant-photo.js
 * and BEFORE the drop_legacy_plant_photo_columns migration — the sanity
 * sample compares against Plant.imageUrl, which is dropped after Task 24.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Counts by source
  const bySource = await prisma.plantPhoto.groupBy({
    by: ['source'],
    _count: { _all: true },
  });
  console.log('PlantPhoto rows by source:', bySource);

  // Plants that have an imageUrl but no primaryPhotoId — should be 0
  const orphanedImageUrl = await prisma.plant.count({
    where: { imageUrl: { not: null }, primaryPhotoId: null },
  });
  console.log(`Plants with imageUrl but no primaryPhotoId: ${orphanedImageUrl} (expect 0)`);

  // Sanity sample: 10 random plants — primary photo URL matches old imageUrl
  const sample = await prisma.plant.findMany({
    where: { primaryPhotoId: { not: null } },
    take: 10,
    select: {
      id: true,
      imageUrl: true,
      primaryPhoto: { select: { imageUrl: true } },
    },
  });
  let mismatches = 0;
  for (const p of sample) {
    const match = p.imageUrl === p.primaryPhoto?.imageUrl;
    if (!match) mismatches++;
    console.log(`  Plant ${p.id}: ${match ? '✓' : '✗'} old=${p.imageUrl} new=${p.primaryPhoto?.imageUrl}`);
  }
  console.log(`Sanity sample: ${mismatches} mismatches out of ${sample.length} (expect 0)`);

  // Orphaned PlantPhoto rows — plantId not matching any Plant. Should be 0.
  // (Prisma doesn't expose anti-join easily; raw SQL is clearest.)
  const orphanedPhotos = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "PlantPhoto" pp
    LEFT JOIN "Plant" p ON p.id = pp."plantId"
    WHERE p.id IS NULL
  `;
  console.log(`Orphaned PlantPhoto rows: ${orphanedPhotos[0].count} (expect 0)`);

  // Photographer attribution coverage — should be in the thousands after
  // the avml.db credits backfill landed.
  const credited = await prisma.plantPhoto.count({
    where: { photographerName: { not: null } },
  });
  console.log(`PlantPhoto rows with photographerName set: ${credited} (expect thousands)`);

  const topPhotographers = await prisma.$queryRaw`
    SELECT "photographerName", COUNT(*)::int AS photo_count
    FROM "PlantPhoto"
    WHERE "photographerName" IS NOT NULL
    GROUP BY "photographerName"
    ORDER BY photo_count DESC
    LIMIT 5
  `;
  console.log('Top photographers by photo count:');
  for (const row of topPhotographers) {
    console.log(`  ${row.photographerName}: ${row.photo_count}`);
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the verification script**

Run: `node scripts/verify-photo-migration.js`
Expected output sketch:
```
PlantPhoto rows by source: [ { source: 'AVSA_SEEDED', _count: { _all: <large> } }, ... ]
Plants with imageUrl but no primaryPhotoId: 0 (expect 0)
  Plant 1: ✓ old=... new=...
  ...
Sanity sample: 0 mismatches out of 10 (expect 0)
Orphaned PlantPhoto rows: 0 (expect 0)
PlantPhoto rows with photographerName set: <thousands> (expect thousands)
Top photographers by photo count:
  Marjorie Bullard: ...
  AVSA: ...
  Joan Baker: ...
  Linda Rowe: ...
  Belinda Thibodeaux: ...
```

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-photo-migration.js
git commit -m "Add post-migration verification script"
```

---

## Phase C — Backend changes

### Task 12: Update user photo upload endpoint to require own-work affirmation

**Files:**
- Modify: `server/index.js` (the `POST /api/plants/:plantId/photos/upload` handler, line 1117)

- [ ] **Step 1: Update the handler**

Find the handler at `server/index.js:1117`:

```js
app.post('/api/plants/:plantId/photos/upload', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const plantId = parseInt(req.params.plantId);

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
```

After the `req.file` check, insert the affirmation check:

```js
    // Defense in depth: client also gates submit, but trust nothing from client.
    // Boolean parsed from multipart form data may arrive as string 'true'.
    const affirmed = req.body.affirmedOwnWork === true || req.body.affirmedOwnWork === 'true';
    if (!affirmed) {
      return res.status(400).json({ error: 'You must affirm this is your own photo to upload.' });
    }
```

Then find the `prisma.plantPhoto.create` block in the same handler:

```js
    const photo = await prisma.plantPhoto.create({
      data: {
        plantId,
        userId: req.user.id,
        imageUrl: urls.main,
        thumbnailUrl: urls.thumb,
        caption: req.body.caption || null,
      }
    });
```

Replace with (adds `source: 'USER'` explicitly even though it's the default, plus sets `Plant.primaryPhotoId` if the plant has none yet):

```js
    const photo = await prisma.$transaction(async (tx) => {
      const created = await tx.plantPhoto.create({
        data: {
          plantId,
          userId: req.user.id,
          imageUrl: urls.main,
          thumbnailUrl: urls.thumb,
          caption: req.body.caption || null,
          source: 'USER',
        }
      });
      // If the plant has no primary yet, point it at this new photo so the
      // catalog grid has something to render.
      if (plant.primaryPhotoId === null) {
        await tx.plant.update({
          where: { id: plantId },
          data: { primaryPhotoId: created.id },
        });
      }
      return created;
    });
```

- [ ] **Step 2: Smoke check via curl (with a real session cookie)**

In one shell, start the server (`npm run dev`). In another shell, attempt an upload without the affirmation:

```bash
curl -sS -X POST http://localhost:3001/api/plants/1/photos/upload \
  -H "Cookie: <your-session-cookie>" \
  -F "photo=@/path/to/test.jpg"
```
Expected: HTTP 400 with `{"error":"You must affirm this is your own photo to upload."}`.

Now retry with affirmation:
```bash
curl -sS -X POST http://localhost:3001/api/plants/1/photos/upload \
  -H "Cookie: <your-session-cookie>" \
  -F "photo=@/path/to/test.jpg" \
  -F "affirmedOwnWork=true"
```
Expected: HTTP 200 with photo JSON; `source: 'USER'`.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "Require affirmedOwnWork on user photo uploads; set primaryPhotoId if unset"
```

---

### Task 13: Wire DELETE /api/photos/:id through canDeletePhoto

**Files:**
- Modify: `server/index.js` (the `DELETE /api/photos/:id` handler, line 1165)

This task **also fixes a pre-existing security bug**: the current endpoint has no auth middleware at all. Anyone with a photo ID can delete any photo.

- [ ] **Step 1: Add the import**

In `server/index.js` near the top of the file (after the existing `requireAuth` import), add:

```js
import { canDeletePhoto, canCurateArchive, canSetCoverPhoto } from './lib/auth-helpers.js';
```

(The other two helpers are imported now for later tasks; consolidating to one import line.)

- [ ] **Step 2: Update the DELETE handler**

Find `server/index.js:1165`:

```js
// DELETE photo
app.delete('/api/photos/:id', async (req, res) => {
  try {
    await prisma.plantPhoto.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Replace with:

```js
// DELETE photo
app.delete('/api/photos/:id', requireAuth, async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    const photo = await prisma.plantPhoto.findUnique({
      where: { id: photoId },
      select: { id: true, userId: true, source: true },
    });
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (!canDeletePhoto(req.user, photo)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.plantPhoto.delete({ where: { id: photoId } });
    res.json({ message: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 3: Smoke checks**

Start the server. Try without auth:
```bash
curl -sS -X DELETE http://localhost:3001/api/photos/999999
```
Expected: `{"error":"Authentication required"}` (HTTP 401).

Try as a regular user against an archive photo:
```bash
curl -sS -X DELETE -H "Cookie: <regular-user-cookie>" \
  http://localhost:3001/api/photos/<archive-photo-id>
```
Expected: `{"error":"Forbidden"}` (HTTP 403).

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "Gate DELETE /api/photos/:id with canDeletePhoto helper"
```

---

### Task 14: Add POST /api/admin/photos/archive endpoint

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add the route**

Insert this handler in `server/index.js` immediately after the existing user-upload handler (after the `}` that closes the upload route around line 1162):

```js
/**
 * UPLOAD an archive photo (admin only).
 *
 * Used for historical / permissioned photos where the photographer is not
 * the uploader. Requires photographerName + attributionNote (free text).
 */
app.post('/api/admin/photos/archive', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const { plantId, photographerName, attributionNote, caption } = req.body;
    if (!plantId) return res.status(400).json({ error: 'plantId is required' });
    if (!photographerName || !photographerName.trim()) {
      return res.status(400).json({ error: 'photographerName is required for archive uploads' });
    }
    if (!attributionNote || !attributionNote.trim()) {
      return res.status(400).json({ error: 'attributionNote is required for archive uploads' });
    }

    if (!process.env.DO_SPACES_BUCKET) {
      return res.status(500).json({ error: 'Image upload not configured' });
    }

    const plantIdInt = parseInt(plantId);
    const plant = await prisma.plant.findUnique({ where: { id: plantIdInt } });
    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    const photoId = randomUUID();
    const baseKey = `archive-photos/${plantIdInt}/${photoId}`;
    const urls = await uploadImageVersions(req.file.buffer, baseKey);

    const photo = await prisma.$transaction(async (tx) => {
      const created = await tx.plantPhoto.create({
        data: {
          plantId: plantIdInt,
          userId: req.user.id,  // uploader provenance, NOT photographer credit
          imageUrl: urls.main,
          thumbnailUrl: urls.thumb,
          caption: caption || null,
          source: 'ARCHIVE',
          photographerName: photographerName.trim(),
          attributionNote: attributionNote.trim(),
        }
      });
      if (plant.primaryPhotoId === null) {
        await tx.plant.update({
          where: { id: plantIdInt },
          data: { primaryPhotoId: created.id },
        });
      }
      return created;
    });

    res.json(photo);
  } catch (error) {
    console.error('Archive photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload archive photo' });
  }
});
```

- [ ] **Step 2: Smoke checks via curl**

Start the server. Try unauthenticated:
```bash
curl -sS -X POST http://localhost:3001/api/admin/photos/archive
```
Expected: `{"error":"Authentication required"}`.

Try as a regular user:
```bash
curl -sS -X POST -H "Cookie: <regular-user-cookie>" \
  http://localhost:3001/api/admin/photos/archive
```
Expected: `{"error":"Admin access required"}`.

As admin without required fields:
```bash
curl -sS -X POST -H "Cookie: <admin-cookie>" \
  http://localhost:3001/api/admin/photos/archive \
  -F "photo=@/path/to/test.jpg" \
  -F "plantId=1"
```
Expected: `{"error":"photographerName is required for archive uploads"}`.

As admin with all required fields:
```bash
curl -sS -X POST -H "Cookie: <admin-cookie>" \
  http://localhost:3001/api/admin/photos/archive \
  -F "photo=@/path/to/test.jpg" \
  -F "plantId=1" \
  -F "photographerName=Test Photographer" \
  -F "attributionNote=Test grant 2026"
```
Expected: HTTP 200 with photo JSON; `source: 'ARCHIVE'`, `photographerName: 'Test Photographer'`.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "Add POST /api/admin/photos/archive endpoint"
```

---

### Task 15: Add PATCH /api/plants/:id/primary-photo endpoint

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add the route**

Insert in `server/index.js` just after the archive upload route from Task 14:

```js
/**
 * Set the primary (cover) photo for a plant.
 * Body: { photoId }
 */
app.patch('/api/plants/:id/primary-photo', requireAuth, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { photoId } = req.body;
    if (!photoId) return res.status(400).json({ error: 'photoId is required' });

    const plant = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    if (!canSetCoverPhoto(req.user, plant)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Confirm the photo belongs to this plant
    const photo = await prisma.plantPhoto.findUnique({
      where: { id: parseInt(photoId) },
      select: { id: true, plantId: true },
    });
    if (!photo || photo.plantId !== plantId) {
      return res.status(400).json({ error: 'Photo does not belong to this plant' });
    }

    const updated = await prisma.plant.update({
      where: { id: plantId },
      data: { primaryPhotoId: parseInt(photoId) },
      select: { id: true, primaryPhotoId: true },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 2: Smoke check**

```bash
curl -sS -X PATCH -H "Cookie: <admin-cookie>" -H "Content-Type: application/json" \
  http://localhost:3001/api/plants/1/primary-photo \
  -d '{"photoId": <some-photo-id-for-plant-1>}'
```
Expected: HTTP 200 with `{ id: 1, primaryPhotoId: <photoId> }`.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "Add PATCH /api/plants/:id/primary-photo endpoint"
```

---

### Task 16: Update plant GET responses to include primaryPhoto

**Files:**
- Modify: `server/index.js` (the single-plant GET, around line 591; the catalog list endpoints around lines 527 and earlier)

- [ ] **Step 1: Locate and update the single-plant GET**

Find the single-plant GET handler near `server/index.js:591`. In its Prisma `findUnique` (or `findFirst`) call, find the `include`/`select`. The existing `userPhotos: { orderBy: { uploadedAt: 'desc' } }` relation include needs to be renamed to `photos` (matching the schema rename in Task 5), and `primaryPhoto` needs to be added.

Edit the include block:

Find:
```js
        userPhotos: { ... orderBy: { uploadedAt: 'desc' } ... }
```

Replace with:
```js
        photos: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            userId: true,
            imageUrl: true,
            thumbnailUrl: true,
            caption: true,
            uploadedAt: true,
            source: true,
            photographerName: true,
            attributionNote: true,
          }
        },
        primaryPhoto: {
          select: {
            id: true,
            imageUrl: true,
            thumbnailUrl: true,
            source: true,
            photographerName: true,
          }
        },
```

- [ ] **Step 2: Locate and update the catalog list endpoints**

For the GET endpoints returning plant lists (catalog browse, list-view), find every `findMany` call that returns plants and add a `primaryPhoto` include (the catalog grid needs `thumbnailUrl` from it). Existing code accesses `plant.thumbnailUrl` directly — that field still exists at this stage (we drop it in Task 24), so the change here is **additive**: include `primaryPhoto` alongside the old fields without breaking anything.

Search for plant-returning queries:

```bash
grep -nE "prisma\.plant\.findMany" server/index.js
```

For each match, ensure the result includes `primaryPhoto: { select: { id: true, imageUrl: true, thumbnailUrl: true } }`. If the query doesn't currently use `select`/`include`, add an `include: { primaryPhoto: { ... } }` clause.

- [ ] **Step 3: Smoke check**

Start the server. Fetch a single plant:
```bash
curl -sS http://localhost:3001/api/plants/1 | jq '{ id, name, hasPrimaryPhoto: (.primaryPhoto != null), photoCount: (.photos | length) }'
```
Expected: `hasPrimaryPhoto: true`, `photoCount` matches expected.

Fetch the catalog grid:
```bash
curl -sS "http://localhost:3001/api/plants?limit=5" | jq '.[0] | { id, name, hasPrimaryPhoto: (.primaryPhoto != null) }'
```
Expected: `hasPrimaryPhoto: true`.

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "Include primaryPhoto and renamed photos relation in plant GET responses"
```

---

## Phase D — Frontend changes

### Task 17: Update PlantCard to read primaryPhoto

**Files:**
- Modify: `src/components/PlantCard.jsx`

- [ ] **Step 1: Survey current usage**

Run: `grep -nE "(thumbnailUrl|imageUrl|featuredPhotos)" src/components/PlantCard.jsx`
Note the lines that reference these fields.

- [ ] **Step 2: Update the reads with fallbacks**

For each occurrence, change reads from `plant.thumbnailUrl` to `plant.primaryPhoto?.thumbnailUrl || plant.primaryPhoto?.imageUrl`, and from `plant.imageUrl` to `plant.primaryPhoto?.imageUrl`. The fallback chain is important because some photos lack a thumbnail.

Example pattern — if the file has:
```jsx
<img src={plant.thumbnailUrl} alt={plant.name} />
```

Change to:
```jsx
<img
  src={plant.primaryPhoto?.thumbnailUrl || plant.primaryPhoto?.imageUrl || '/placeholder.png'}
  alt={plant.name}
/>
```

(Use whichever placeholder path the existing component already uses for plants without photos.)

- [ ] **Step 3: Browser smoke check**

Run: `npm run dev` and load the catalog grid in the browser. Confirm thumbnails render exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/PlantCard.jsx
git commit -m "Read PlantCard image from primaryPhoto relation"
```

---

### Task 18: Update ListView to read primaryPhoto

**Files:**
- Modify: `src/components/ListView.jsx`

- [ ] **Step 1: Apply the same pattern as Task 17**

Run: `grep -nE "(thumbnailUrl|imageUrl|featuredPhotos)" src/components/ListView.jsx`

For each occurrence, change reads to use the `primaryPhoto` relation with the same fallback chain (`primaryPhoto?.thumbnailUrl || primaryPhoto?.imageUrl || '/placeholder.png'`).

- [ ] **Step 2: Browser smoke check**

In the browser, navigate to any list page; confirm thumbnails render unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListView.jsx
git commit -m "Read ListView image from primaryPhoto relation"
```

---

### Task 19: Update PlantFormDialog with own-work affirmation

**Files:**
- Modify: `src/components/PlantFormDialog.jsx`

- [ ] **Step 1: Find the photo-upload section**

Run: `grep -nE "(upload|photo|Submit|onSubmit|FormControlLabel)" src/components/PlantFormDialog.jsx | head -30`

- [ ] **Step 2: Add the affirmation state and checkbox**

Near the other `useState` calls in the component, add:

```jsx
const [affirmedOwnWork, setAffirmedOwnWork] = useState(false);
```

In the form area where the photo file picker lives, add this block immediately below the file input:

```jsx
<FormControlLabel
  control={
    <Checkbox
      checked={affirmedOwnWork}
      onChange={(e) => setAffirmedOwnWork(e.target.checked)}
    />
  }
  label="I took this photo myself and I'm granting Violetteer permission to display it on this site."
  sx={{ alignItems: 'flex-start', mt: 1 }}
/>
<Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
  Didn't take this photo yourself? We accept historical and permissioned photos through
  our curators. Email <Link href="mailto:hello@violetteer.com">hello@violetteer.com</Link> to contribute.
</Typography>
```

(Add `Checkbox`, `FormControlLabel`, `Link`, `Typography` to the existing `@mui/material` imports if not already present.)

- [ ] **Step 3: Gate submit on the affirmation**

Find the submit button and the upload submit handler. Disable the button when there's a file selected but no affirmation:

```jsx
<Button
  type="submit"
  variant="contained"
  disabled={loading || (hasSelectedFile && !affirmedOwnWork)}
>
  ...
</Button>
```

In the upload handler that does the `fetch`/`POST`, append `affirmedOwnWork` to the FormData:

```js
formData.append('affirmedOwnWork', 'true');
```

- [ ] **Step 4: Browser smoke check**

Run the dev server. Open a plant page as a logged-in user, attempt to upload a photo:
- Submit button disabled until checkbox checked: ✓
- Successful upload after checking: ✓
- Help text + mailto link visible: ✓

- [ ] **Step 5: Commit**

```bash
git add src/components/PlantFormDialog.jsx
git commit -m "Require own-work affirmation on user photo uploads"
```

---

### Task 20: Create ArchiveUploadDialog component

**Files:**
- Create: `src/components/admin/ArchiveUploadDialog.jsx`

- [ ] **Step 1: Check whether the directory exists**

Run: `ls src/components/admin 2>/dev/null || mkdir -p src/components/admin`

- [ ] **Step 2: Write the component**

Write `src/components/admin/ArchiveUploadDialog.jsx`:

```jsx
import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Alert, CircularProgress, Typography, Link,
} from '@mui/material';

const EXAMPLE_NOTES = [
  '"From the collection of [Photographer Name] (d. 2017). Used by permission of his daughter Jane Doe, granted 2024-09."',
  '"Submitted with original AVSA registration filing, 1987. Photographer credited; rights presumed assigned to AVSA."',
  '"CC BY 4.0 — sourced from Flickr user [handle], https://flickr.com/photos/handle/123456. Attribution preserved per license."',
  '"Public domain by age — published in The American Magazine of African Violets, vol. 12, 1962."',
];

export default function ArchiveUploadDialog({ open, onClose, plantId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [photographerName, setPhotographerName] = useState('');
  const [attributionNote, setAttributionNote] = useState('');
  const [caption, setCaption] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFile(null);
    setPhotographerName('');
    setAttributionNote('');
    setCaption('');
    setShowExamples(false);
    setError('');
  };

  const handleClose = () => { if (!loading) { reset(); onClose(); } };

  const canSubmit = file && photographerName.trim() && attributionNote.trim() && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('plantId', String(plantId));
      formData.append('photographerName', photographerName.trim());
      formData.append('attributionNote', attributionNote.trim());
      if (caption.trim()) formData.append('caption', caption.trim());

      const res = await fetch('/api/admin/photos/archive', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const photo = await res.json();
      reset();
      onClose();
      onUploaded?.(photo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload archive photo</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }} disabled={loading}>
            {file ? file.name : 'Choose image (JPG, PNG, WebP)'}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Button>

          <TextField
            label="Photographer's name"
            fullWidth required disabled={loading}
            value={photographerName}
            onChange={(e) => setPhotographerName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Attribution note"
            fullWidth required multiline rows={3} disabled={loading}
            value={attributionNote}
            onChange={(e) => setAttributionNote(e.target.value)}
            placeholder='e.g., "Used with permission of David Johnson; granted via email 2024-11-15."'
            helperText="License, permission source, or origin"
            sx={{ mb: 1 }}
          />

          <Link
            component="button" type="button" variant="caption"
            onClick={(e) => { e.preventDefault(); setShowExamples(s => !s); }}
            sx={{ display: 'block', mb: 2 }}
          >
            {showExamples ? 'Hide' : 'ⓘ More'} examples
          </Link>
          {showExamples && (
            <Box sx={{ mb: 2, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
              {EXAMPLE_NOTES.map((ex, i) => (
                <Typography key={i} variant="caption" component="div" sx={{ mb: 1, color: 'text.secondary' }}>
                  {ex}
                </Typography>
              ))}
            </Box>
          )}

          <TextField
            label="Caption (optional)"
            fullWidth disabled={loading}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Upload archive photo'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ArchiveUploadDialog.jsx
git commit -m "Add ArchiveUploadDialog component"
```

---

### Task 21: Wire ArchiveUploadDialog + attribution badges into PlantDetail

**Files:**
- Modify: `src/components/PlantDetail.jsx`

- [ ] **Step 1: Survey the gallery section**

Run: `grep -nE "(userPhotos|gallery|photo|Photo)" src/components/PlantDetail.jsx | head -30`

- [ ] **Step 2: Update photo data source — userPhotos → photos**

Find every reference to `plant.userPhotos` and replace with `plant.photos`.

- [ ] **Step 3: Add attribution overlays in the gallery**

Wherever a gallery thumbnail is rendered, when the photo's `source !== 'USER'`, overlay a camera icon with a tooltip showing the photographer name. Example pattern — replace a bare thumbnail render:

```jsx
{plant.photos.map(photo => (
  <img key={photo.id} src={photo.thumbnailUrl} alt="" />
))}
```

with:

```jsx
{plant.photos.map(photo => (
  <Box key={photo.id} sx={{ position: 'relative', display: 'inline-block' }}>
    <img src={photo.thumbnailUrl || photo.imageUrl} alt="" />
    {photo.source !== 'USER' && photo.photographerName && (
      <Tooltip title={`Photo by ${photo.photographerName}`} arrow>
        <CameraAltIcon
          sx={{
            position: 'absolute', bottom: 4, right: 4,
            color: 'white', fontSize: 18,
            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.6))',
          }}
        />
      </Tooltip>
    )}
  </Box>
))}
```

Add `Tooltip`, `Box` to MUI imports and `CameraAltIcon as CameraAltIcon` from `@mui/icons-material`.

- [ ] **Step 4: Add the credit line in the lightbox/expanded view**

Find the lightbox or expanded-photo render. Below the image, render the credit line when the photo has attribution:

```jsx
{currentPhoto.source !== 'USER' && currentPhoto.photographerName && (
  <Box sx={{ mt: 1 }}>
    <Typography variant="body2">
      Photo by {currentPhoto.photographerName}
    </Typography>
    {currentPhoto.attributionNote && (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {currentPhoto.attributionNote}
      </Typography>
    )}
  </Box>
)}
```

- [ ] **Step 5: Add the admin archive-upload button**

Near the top of the gallery section (only when admin), add:

```jsx
{user?.isAdmin && (
  <Button
    variant="outlined"
    onClick={() => setShowArchiveDialog(true)}
    sx={{ mb: 2 }}
  >
    Upload archive photo
  </Button>
)}

<ArchiveUploadDialog
  open={showArchiveDialog}
  onClose={() => setShowArchiveDialog(false)}
  plantId={plant.id}
  onUploaded={() => refetchPlant()}
/>
```

Add at the top of the file:
```jsx
import ArchiveUploadDialog from './admin/ArchiveUploadDialog.jsx';
```

Add the `showArchiveDialog` state alongside other `useState` calls:
```jsx
const [showArchiveDialog, setShowArchiveDialog] = useState(false);
```

Where `user` and `refetchPlant` come from depends on existing wiring — if `useAuth()` is already used in this file, reuse it; otherwise add `import { useAuth } from '../context/AuthContext'`. If the plant fetch already has a refetch function in scope, reuse it; otherwise this can be a window reload as a fallback for now.

- [ ] **Step 6: Browser smoke check**

Sign in as admin (or set `User.isAdmin = true` directly in psql for a test user). Navigate to any plant detail page:
- "Upload archive photo" button visible.
- Click it → dialog opens with all the form fields.
- Upload a test photo with photographer name + attribution note → success; gallery refreshes with the new photo.
- Hover the new photo's thumbnail → camera icon overlay shows photographer name tooltip.
- Expand to lightbox → credit line + attribution note visible.

Sign in as a regular (non-admin) user:
- "Upload archive photo" button NOT visible.

- [ ] **Step 7: Commit**

```bash
git add src/components/PlantDetail.jsx
git commit -m "Wire ArchiveUploadDialog and attribution badges into PlantDetail"
```

---

## Phase E — Seed update, smoke, drop legacy columns

### Task 22: Update seed.js to produce the new shape

**Files:**
- Modify: `prisma/seed.js`

- [ ] **Step 1: Survey current seed shape**

Run: `grep -nE "(imageUrl|thumbnailUrl|featuredPhotos|plantPhoto)" prisma/seed.js`

- [ ] **Step 2: Update plant seeds**

For each plant the seed creates, after the `prisma.plant.create(...)`, immediately create a corresponding PlantPhoto row (if the seed previously set imageUrl on the plant) and set primaryPhotoId. Example replacement pattern:

Before:
```js
const plant = await prisma.plant.create({
  data: {
    name: 'Demo Violet',
    imageUrl: 'https://.../demo.jpg',
    thumbnailUrl: 'https://.../demo-thumb.jpg',
    featuredPhotos: ['https://.../demo.jpg', 'https://.../alt.jpg'],
    // ...
  }
});
```

After:
```js
const plant = await prisma.plant.create({
  data: {
    name: 'Demo Violet',
    // imageUrl/thumbnailUrl/featuredPhotos still in schema until Task 23.
    // For seed cleanliness, omit them and use PlantPhoto rows directly.
  }
});
const primary = await prisma.plantPhoto.create({
  data: {
    plantId: plant.id,
    source: 'AVSA_SEEDED',
    imageUrl: 'https://.../demo.jpg',
    thumbnailUrl: 'https://.../demo-thumb.jpg',
  }
});
await prisma.plantPhoto.create({
  data: {
    plantId: plant.id,
    source: 'AVSA_SEEDED',
    imageUrl: 'https://.../alt.jpg',
  }
});
await prisma.plant.update({
  where: { id: plant.id },
  data: { primaryPhotoId: primary.id },
});
```

For demo user-uploaded photos, create them with `source: 'USER'` and the `userId` of the demo user.

- [ ] **Step 3: Reset the database and re-seed**

```bash
npx prisma migrate reset
```
Expected: DB drops, migrations re-apply, `prisma/seed.js` runs. No errors.

- [ ] **Step 4: Verify the seeded state**

```bash
psql <DBNAME> -c "SELECT source, COUNT(*) FROM \"PlantPhoto\" GROUP BY source;"
psql <DBNAME> -c "SELECT COUNT(*) FROM \"Plant\" WHERE \"primaryPhotoId\" IS NOT NULL;"
```
Expected: both counts > 0 with reasonable values.

**WARNING:** this step wipes the local DB. Make sure the backup from Task 6 still exists if you want to recover the migrated data.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.js
git commit -m "Update seed to produce PlantPhoto rows with source + primaryPhotoId"
```

---

### Task 23: Run the smoke checklist before dropping legacy columns

**Files:**
- (No file changes)

Walk through the full smoke checklist with the dev server running and the DB seeded:

- [ ] Catalog grid loads with thumbnails
- [ ] Plant detail gallery shows attribution overlay for AVSA_SEEDED or ARCHIVE photos that have photographerName
- [ ] Lightbox expand shows credit line for archive photos
- [ ] Logged-out user can browse but cannot upload (no upload UI shown)
- [ ] Logged-in regular user upload flow: checkbox required; submit disabled until checked
- [ ] User upload creates `source='USER'` row (verify via psql)
- [ ] Admin sees "Upload archive photo" button on PlantDetail; non-admin does NOT
- [ ] Admin archive upload requires photographer name + attribution note (form gates submission)
- [ ] Admin archive upload creates `source='ARCHIVE'` row with both attribution fields populated
- [ ] curl `POST /api/plants/1/photos/upload` without `affirmedOwnWork=true` returns 400
- [ ] As user A: deleting your own USER photo works (`200`); deleting user B's USER photo returns 403
- [ ] As admin: deleting any photo works
- [ ] Deleting a primary photo nulls `Plant.primaryPhotoId` (verify via psql); detail page falls back to a different photo or placeholder

If any smoke item fails, FIX it before proceeding to Task 24. Do not let bugs ride into the destructive migration.

- [ ] **No commit (verification only)**

---

### Task 24: Drop legacy columns (drop_legacy_plant_photo_columns migration)

**Files:**
- Modify: `prisma/schema.prisma`
- Create (auto): `prisma/migrations/<timestamp>_drop_legacy_plant_photo_columns/migration.sql`

This is destructive. The smoke checklist must have passed first.

- [ ] **Step 1: Take a fresh backup**

```bash
pg_dump <DBNAME> | gzip > ~/violetteer-backup-2026-06-08-pre-drop-legacy.sql.gz
ls -lh ~/violetteer-backup-2026-06-08-pre-drop-legacy.sql.gz
```
Expected: backup file written.

- [ ] **Step 2: Remove the three fields from the Plant model**

In `prisma/schema.prisma`, in the `Plant` model, remove these lines:

```prisma
  imageUrl              String?
  thumbnailUrl          String?
  featuredPhotos        String[]
```

- [ ] **Step 3: Generate + apply the migration**

```bash
npx prisma migrate dev --name drop_legacy_plant_photo_columns
```
Expected: Prisma drops the three columns. No errors.

- [ ] **Step 4: Final verification**

```bash
psql <DBNAME> -c "\d \"Plant\"" | grep -E "(imageUrl|thumbnailUrl|featuredPhotos)"
```
Expected: no output (columns gone).

Reload the app in the browser and re-run the smoke checklist Items 1–3 (catalog, gallery, lightbox). Anything broken means a frontend reference to a removed column was missed in Task 17/18/21.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Drop legacy Plant.imageUrl/thumbnailUrl/featuredPhotos columns"
```

---

### Task 25: Update memory + project notes

**Files:**
- Modify: `~/.claude/projects/-Users-sara-projects-violetteer/memory/MEMORY.md`
- Create: `~/.claude/projects/-Users-sara-projects-violetteer/memory/reference_photo_attribution.md`

- [ ] **Step 1: Write the reference memory**

Document the new schema shape + invariants:
- `PlantPhoto.source` values + meaning
- The `Plant.primaryPhotoId` pattern
- Auth helpers module location + the no-direct-isAdmin convention
- The migration script's one-shot nature
- Pointer back to this plan + the spec

- [ ] **Step 2: Index it in MEMORY.md**

Add a one-line entry under a relevant section (probably "Key Files" or a new "Photo system" subsection).

- [ ] **Step 3: No commit (memory is outside the repo)**

---

## Self-Review

### Spec coverage check

| Spec requirement | Task(s) |
|---|---|
| `PlantPhoto.source` + `photographerName` + `attributionNote` columns | Task 5 |
| `Plant.primaryPhotoId` FK with named relations | Task 5 |
| `@@index([plantId, source])` | Task 5 |
| `PHOTO_SOURCES` constants module | Task 1 |
| `server/lib/auth-helpers.js` with 4 resource-aware functions | Task 2 |
| Verification for helpers (smoke layer 1) | Task 3 |
| `requireAdmin` routed through `canCurateArchive` | Task 4 |
| Data migration: `imageUrl`/`featuredPhotos` → PlantPhoto rows | Tasks 7, 8 |
| Backfill 3 known credits from `avml.db` | Task 9 |
| Idempotency + dry-run flag | Tasks 7, 8 |
| `scripts/verify-photo-migration.js` | Task 11 |
| `POST /api/admin/photos/archive` | Task 14 |
| `POST /api/plants/:id/photos` requires `affirmedOwnWork` | Task 12 |
| `DELETE /api/photos/:id` via `canDeletePhoto` | Task 13 |
| `PATCH /api/plants/:id/primary-photo` | Task 15 |
| Plant GET responses include `primaryPhoto` + renamed `photos` | Task 16 |
| `PlantCard` / `ListView` read `primaryPhoto` | Tasks 17, 18 |
| `PlantFormDialog` own-work affirmation | Task 19 |
| `ArchiveUploadDialog` component | Task 20 |
| Attribution badges on `PlantDetail` + admin button | Task 21 |
| `prisma/seed.js` updated | Task 22 |
| Smoke checklist | Task 23 |
| Drop legacy columns (final migration) | Task 24 |

No gaps detected.

### Placeholder scan

No "TBD", "TODO", or "fill in later" steps. All code blocks contain real code; all verification steps contain real commands and expected output.

### Type consistency

- `canCurateArchive`, `canEditCatalogPlant`, `canSetCoverPhoto`, `canDeletePhoto` — consistent names across Tasks 2, 4, 13, 14, 15.
- `PHOTO_SOURCES.USER` / `'USER'` string used directly in API code (Tasks 12, 14) — matches the constants module convention (string values match).
- `primaryPhotoId`, `primaryPhoto`, `photos` field names match between schema (Task 5), backend (Tasks 16, 12, 14), and frontend (Tasks 17, 18, 21).
- `affirmedOwnWork` body field consistent in backend (Task 12) and frontend (Task 19).
- `photographerName`, `attributionNote` consistent across schema, API, dialog, and display surfaces.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-08-photo-attribution.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for plans with many discrete tasks; each subagent gets a clean context window for its task only.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Best if you want to watch each change happen in real-time and step in mid-task.

Which approach?
