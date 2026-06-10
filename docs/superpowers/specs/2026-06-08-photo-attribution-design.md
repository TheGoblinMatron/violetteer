# Photo attribution + admin archive uploads — design

**Date**: 2026-06-08
**Status**: Approved by Sara; ready for implementation planning
**Predecessor of**: Account deletion + GDPR export design (next brainstorm)

## Summary

Add photographer attribution to Violetteer's photo system and introduce an admin-only "archive upload" flow for historical and permissioned photos. Consolidate the catalog's three current photo storage shapes (`Plant.imageUrl`, `Plant.thumbnailUrl`, `Plant.featuredPhotos[]`, plus `PlantPhoto` rows) into a single `PlantPhoto` table with a `source` discriminator and attribution columns. Introduce a forward-compatible authorization helpers module that today reads `User.isAdmin` but is structured so that future role expansion (hybridizer, curator, admin) and resource-scoped permissions are one-file changes.

## Goals

- Capture photographer credit and rights-provenance for any photo on the site.
- Provide a controlled admin-only channel for uploading historical/permissioned photos (own work is not the only legitimate source).
- Enforce, at upload time, the user-side policy that regular-user uploads are own-work-only.
- Unify catalog and user photo storage so future operations (cover photo selection, attribution display, deletion semantics, full-text search across captions) have one place to operate.
- Set up authorization so that the future role expansion is a small change, not a refactor through `server/index.js`.

## Non-goals (explicitly deferred)

- Account deletion + GDPR data export (next brainstorm; will lean on `PlantPhoto.source` to distinguish personal vs. shared photos).
- Hybridizer identity verification flow.
- Full role expansion (USER / CURATOR / HYBRIDIZER / ADMIN). Helpers are *shaped* for it; bodies aren't there yet.
- Cover photo selection UI. The helper exists; the route exists; the UI is a small future task.
- An in-app submission queue replacing the `hello@violetteer.com` email redirect. Beta-phase shortcut; see "Known beta-phase shortcut" below.
- Structured license enums or per-license queryability. Free-text attribution note is sufficient today.
- Bulk archive upload. No volume justifies it.

## Approach (and the main alternative rejected)

**Selected:** Unified `PlantPhoto` table with `source` enum + attribution columns + a `Plant.primaryPhotoId` denormalized FK for catalog-grid speed. Archive-upload flow is admin-only via a new resource-aware auth-helpers module.

**Rejected:** A separate `ArchivePhoto` table next to `PlantPhoto`. Cleaner conceptual separation, but doubles every read path (every plant detail page UNIONs photo sources), doubles cascade decisions, and complicates the future cover-photo selection feature.

## Architecture overview

```
┌─ Data layer ─────────────────────────────────────────────────┐
│  Prisma schema:                                              │
│    PlantPhoto gains: source, photographerName,               │
│      attributionNote                                         │
│    Plant gains: primaryPhotoId (FK to PlantPhoto)            │
│    Plant loses: imageUrl, thumbnailUrl, featuredPhotos       │
│      (after migration completes)                             │
│                                                              │
│  One-shot migration script                                   │
│  (scripts/migrate-photos-to-plant-photo.js):                 │
│    1. Move Plant.imageUrl / featuredPhotos[] → PlantPhoto    │
│       rows with source='AVSA_SEEDED'                         │
│    2. Set Plant.primaryPhotoId from the old imageUrl row     │
│    3. Backfill ~10K photographer credits from avml.db (URL match)│
│    4. Drop the deprecated columns (separate Prisma migration)│
└──────────────────────────────────────────────────────────────┘
┌─ Server layer ───────────────────────────────────────────────┐
│  server/lib/auth-helpers.js (NEW):                           │
│    canCurateArchive(user)                                    │
│    canEditCatalogPlant(user, plant)                          │
│    canSetCoverPhoto(user, plant)                             │
│    canDeletePhoto(user, photo)                               │
│    All bodies short-circuit on isAdmin today; ready for      │
│    role-based bodies later                                   │
│                                                              │
│  server/index.js changes:                                    │
│    - POST /api/admin/photos/archive (admin-gated)            │
│    - POST /api/plants/:id/photos updated to require          │
│      affirmedOwnWork in body                                 │
│    - PATCH /api/plants/:id/primary-photo (helper-gated)      │
│    - DELETE /api/photos/:id refactored to use helper         │
│    - Plant GET responses include primaryPhoto via FK and     │
│      photos[] via PlantPhoto rows                            │
└──────────────────────────────────────────────────────────────┘
┌─ Client layer ───────────────────────────────────────────────┐
│  Files touched:                                              │
│    src/components/PlantCard.jsx — read primaryPhoto.         │
│      thumbnailUrl instead of plant.thumbnailUrl              │
│    src/components/PlantDetail.jsx — gallery shows attribution│
│      badges for non-USER source photos                       │
│    src/components/ListView.jsx — same as PlantCard           │
│    src/components/PlantFormDialog.jsx — required own-work    │
│      affirmation checkbox                                    │
│    src/components/admin/ArchiveUploadDialog.jsx (NEW) —      │
│      admin-only attribution form                             │
└──────────────────────────────────────────────────────────────┘
```

## Schema changes

Diff against `prisma/schema.prisma`:

```diff
 model Plant {
   id                    Int       @id @default(autoincrement())
   recNum                Int?
   name                  String
   ...
-  imageUrl              String?
-  thumbnailUrl          String?
-  featuredPhotos        String[]
   description           String?
   ...

+  // Denormalized FK to the catalog-grid primary thumbnail.
+  // Set on photo upload; nulls out if that photo is deleted.
+  primaryPhotoId        Int?
+  primaryPhoto          PlantPhoto? @relation("PlantPrimaryPhoto",
+                          fields: [primaryPhotoId], references: [id],
+                          onDelete: SetNull)

   createdAt             DateTime  @default(now())
   updatedAt             DateTime  @updatedAt

-  userPlants            UserPlant[]
-  userPhotos            PlantPhoto[]
+  userPlants            UserPlant[]
+  photos                PlantPhoto[] @relation("PlantAllPhotos")
   reviews               Review[]
   plantTags             PlantTag[]
 }

 model PlantPhoto {
   id           Int      @id @default(autoincrement())
   plantId      Int
-  userId       String?
+  userId       String?  // Who uploaded it (null for AVSA_SEEDED rows)
   imageUrl     String
-  thumbnailUrl String?
+  thumbnailUrl String?  // Required for primary photos (enforced by pipeline, not schema)
   caption      String?
   uploadedAt   DateTime @default(now())

+  // Attribution + provenance
+  source           String   @default("USER")  // 'USER' | 'ARCHIVE' | 'AVSA_SEEDED'
+  photographerName String?
+  attributionNote  String?

-  plant       Plant    @relation(fields: [plantId], references: [id], onDelete: Cascade)
+  plant       Plant    @relation("PlantAllPhotos", fields: [plantId], references: [id], onDelete: Cascade)
   user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

+  primaryFor  Plant?   @relation("PlantPrimaryPhoto")

+  @@index([plantId, source])
 }
```

**Schema design notes:**

- `source` is a `String` rather than a Prisma enum so that adding new values (e.g., `'CC_COMMONS'`, `'PARTNER_FEED'`) doesn't require a schema migration. Canonical values live in `server/lib/photo-constants.js`.
- The cycle between `Plant.primaryPhotoId` and `PlantPhoto.plantId` is resolved by named relations (`PlantPrimaryPhoto`, `PlantAllPhotos`).
- `Plant.primaryPhotoId` uses `onDelete: SetNull` so deleting a photo cleanly nulls the pointer; the read path falls back to "pick any photo or show placeholder."
- The `@@index([plantId, source])` supports the two important reads: all photos for a plant, and all archive photos for a plant.
- `PlantPhoto.thumbnailUrl` stays nullable because legacy/edge cases may not have one. The upload pipeline always generates one for new uploads.
- `Review.userName` is denormalized today (line 263 of the schema) — the precedent for "anonymize on delete via SetNull + denormalized name string" already exists in this codebase. `photographerName` follows the same pattern.

**Constants module:** `server/lib/photo-constants.js`

```js
export const PHOTO_SOURCES = Object.freeze({
  USER: 'USER',                  // User uploaded their own photo
  ARCHIVE: 'ARCHIVE',            // Admin uploaded historical/permissioned photo
  AVSA_SEEDED: 'AVSA_SEEDED',    // Original AVSA catalog photo (pre-Violetteer)
});
```

## Migration & backfill

Migration uses the expand-then-contract pattern: four landings, not one all-or-nothing migration.

```
Step 1 — Prisma migration: add_photo_attribution
  • PlantPhoto: add source (default 'USER'), photographerName, attributionNote
  • Plant: add primaryPhotoId nullable FK
  • Add @@index([plantId, source])
  • Backward-compatible: old code reading Plant.imageUrl still works

Step 2 — Data script: scripts/migrate-photos-to-plant-photo.js
  For each Plant with imageUrl or featuredPhotos:
    a. Create PlantPhoto rows from Plant.imageUrl and Plant.featuredPhotos[]
       - source = 'AVSA_SEEDED'
       - userId = null
       - imageUrl = the URL
       - thumbnailUrl = Plant.thumbnailUrl (only on the row from old imageUrl)
    b. Set Plant.primaryPhotoId to the row created from old imageUrl
    c. Backfill credits from avml.db (path passed as CLI arg):
       - Read credits table (PhotoID CHAR(7), Name CHAR(40); ~10,343 rows)
       - For each (PhotoID, Name): parse PhotoID into <RecNum><letter> and
         find PlantPhoto rows whose imageUrl contains "/<RecNum>-<letter>-main"
         (matches the catalog URL pattern .../catalog/<RecNum>-<letter>-main.webp)
       - Set photographerName = Name on the match
       - Unmatched credits are logged but don't fail (some credits refer to
         photos no longer in the catalog)

  Idempotent: skips plants with primaryPhotoId already set.
  --dry-run flag: prints planned writes without executing.
  Final verification queries print counts:
    - Plants with primaryPhotoId IS NULL AND old imageUrl IS NOT NULL (expect 0)
    - PlantPhoto rows with source='AVSA_SEEDED' (expect ~10K)
    - Plants where primaryPhoto.imageUrl != old Plant.imageUrl (expect 0)

Step 2.5 — Update prisma/seed.js to produce the new shape
  Without this, fresh re-seeds drop you back into broken state.
  Seed produces:
    - PlantPhoto rows with source='AVSA_SEEDED' for catalog photos
    - PlantPhoto rows with source='USER' for demo-user uploads
    - Plant.primaryPhotoId set during seed

Step 3 — Frontend refactor (separate commit, not a migration)
  Update PlantCard, PlantDetail, ListView, PlantFormDialog, and
  server/index.js call sites to read from primaryPhoto / photos[]
  instead of Plant.imageUrl / featuredPhotos. Both shapes work
  simultaneously during this window.

Step 4 — Prisma migration: drop_legacy_plant_photo_columns
  • Plant: drop imageUrl, thumbnailUrl, featuredPhotos
  • Update Prisma schema accordingly
  • Safety: requires Step 3 to be deployed first; running this against
    old client code breaks images.
```

**Operational safeguards:**

- Pre-strip `pg_dump` backup before Step 2 (same pattern as the 2026-06-08 test-strip backup; see `reference_local_db_baseline`).
- The `--dry-run` flag is mandatory before live runs.
- Idempotency means re-running after partial failure is safe.

**Script lifetime:** the migration script is **one-shot per database**. Local dev runs it once; production receives the new shape via `pg_dump` after the local migration. After Step 4, the script in `scripts/` is preserved as a historical artifact but not actively maintained. The only file from this work that's future-relevant is `prisma/seed.js`.

## Authorization helpers

New file: `server/lib/auth-helpers.js`. Every authorization check in the API goes through one of these functions. No route handler reads `user.isAdmin` directly.

**Pattern: resource-aware signatures from day one**, even when the body ignores the resource. When richer roles arrive, function bodies change; callsites don't.

```js
/**
 * @param {{ isAdmin: boolean } | null | undefined} user
 */
export function canCurateArchive(user) {
  return Boolean(user?.isAdmin);
}

/**
 * Today: admin only.
 * Future: hybridizers can edit catalog plants where plant.hybridizer
 * matches user.verifiedHybridizerName.
 */
export function canEditCatalogPlant(user, plant) {
  if (!user) return false;
  if (user.isAdmin) return true;
  // Future: hybridizer self-curation goes here.
  return false;
}

export function canSetCoverPhoto(user, plant) {
  return canEditCatalogPlant(user, plant);
}

/**
 * USER-source photos: uploader or admin.
 * ARCHIVE / AVSA_SEEDED: admin only.
 */
export function canDeletePhoto(user, photo) {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (photo.source === 'USER' && photo.userId === user.id) return true;
  return false;
}
```

**Usage pattern in `server/index.js`:** inline checks at the route handler (`if (!canCurateArchive(req.user)) return res.status(403)...`), not middleware factories. With fewer than ~10 callsites, middleware abstraction adds indirection without benefit, and resource-aware checks need the resource loaded inside the handler anyway.

**Refactor scope:** existing `isAdmin` checks in `server/index.js` are converted to use helpers as part of this work. Even though they're already isAdmin today, routing them through helpers means the future role migration touches only one file.

## Admin archive upload UI

**Entry point:** a "Upload archive photo" button on the existing `PlantDetail.jsx` page, visible only when `canCurateArchive(user)` returns true. Opens `ArchiveUploadDialog` with `plantId` baked in as a prop. Adminness is *contextual* (when on the page of the plant you're curating), not *navigational* (no dedicated `/admin/photos/upload` page).

**New component: `src/components/admin/ArchiveUploadDialog.jsx`**

```
Dialog with form:
  - <DropzoneOrFilePicker />
  - <TextField label="Photographer's name" required />
  - <TextField label="Attribution note" multiline rows={3}
      placeholder="Used with permission of David Johnson;
                   granted via email 2024-11-15." />
  - <ExampleAffordance> "ⓘ More examples" expandable:
      • Estate permission for deceased photographer
      • Historical AVSA registration submission
      • CC BY 4.0 from Flickr
      • Public domain by age
  - <TextField label="Caption (optional)" />
  - Action: Cancel | Upload archive photo
```

**Form validation:**

| Field | Required | Notes |
|---|---|---|
| File | Yes | MIME whitelist: `image/jpeg`, `image/png`, `image/webp`. Reuses existing upload pipeline (resize to 1024px main + 300px thumb, upload to DO Spaces). |
| Photographer's name | Yes | No anonymous archive uploads. |
| Attribution note | Yes | Free-text. Empty defeats the purpose of the archive flow. |
| Caption | No | Aesthetic context only. |

**Server-side submission flow:**

```
1. Client POSTs multipart/form-data to /api/admin/photos/archive
2. Server checks canCurateArchive(req.user) — 403 if not
3. Server validates required fields — 400 if missing
4. Server runs the image through the existing upload pipeline
5. Server creates PlantPhoto row:
     plantId, userId = req.user.id (uploader provenance, not photographer credit),
     source = 'ARCHIVE',
     photographerName, attributionNote, caption,
     imageUrl, thumbnailUrl
6. Server returns the row; client closes dialog + refreshes gallery
```

**Uploader vs. photographer distinction:** `userId` is recorded as the admin who uploaded, separate from `photographerName`. If that admin later deletes their account, `userId` SetNulls but `photographerName` survives. This is the separation the brainstorm was built around.

**Explicit non-features:**

- No bulk upload (no current volume justifies it).
- No plant search/picker (always opened from a plant page; avoids attaching to wrong record).
- No separate `/admin/photos/upload` page.

## Regular user upload UX

`PlantFormDialog.jsx` photo-upload area gains a required own-work affirmation checkbox.

```
┌─ Add a photo ─────────────────────────────────────────────────┐
│  [ Choose file / drag-drop area ]                              │
│                                                                │
│  [ ] I took this photo myself and I'm granting Violetteer      │
│      permission to display it on this site.                    │
│                                                                │
│      Didn't take this photo yourself? We accept historical     │
│      and permissioned photos through our curators.             │
│      Email hello@violetteer.com to contribute.                 │
│                                                                │
│  [ Caption (optional) _______________________________ ]        │
│                                                                │
│                              [ Cancel ]  [ Upload photo ]      │
└────────────────────────────────────────────────────────────────┘
```

**Form behavior:**

- Checkbox is **required**. Submit button is *disabled* until checked, not error-on-submit.
- Help text is always visible below the checkbox (not behind a tooltip) — the redirect path is part of the policy story.
- Server-side defense in depth: endpoint requires `affirmedOwnWork: true` in the body, 400s otherwise.

**Affirmation is not persisted as a column.** `source='USER'` on the row encodes the affirmation by policy: rows with `source='USER'` exist only because the uploader affirmed it's their own work. Adding a separate `affirmedOwnWork Boolean` column would imply a meaningful "USER source but didn't affirm" state, which shouldn't exist.

**Grandfathering:** none required. Violetteer is pre-beta; the 75 test users and their photos were stripped in the 2026-06-08 cleanup. Any leftover `PlantPhoto` rows default to `source='USER'` and are new-policy compliant.

### Known beta-phase shortcut

The `hello@violetteer.com` redirect for users with non-own-work photos is appropriate at beta scale (handful of users, manageable inbox, single curator handling each request manually) but has a clear ceiling. It does not scale beyond beta because:

- Email loses attribution metadata in prose (no structured fields).
- No audit trail of submissions, decisions, or response time.
- No way for additional curators to claim items from a shared queue.

**Post-beta replacement** (separate future design, not this one): an in-app submission form that creates queued moderation tasks. Curators (a role to be introduced when role expansion happens) claim and approve/reject items; approval auto-creates a `PlantPhoto` row with `source='ARCHIVE'`. **Trigger condition for picking this up:** more than ~1 archive submission per week, *or* when adding the first non-admin curator.

## Display behavior

**Catalog grid (`PlantCard`):** No attribution badge. Renders `primaryPhoto.thumbnailUrl` and plant name only.

**Plant detail page (`PlantDetail`):** Attribution renders only for photos with `source !== 'USER'`. Two display surfaces:

- **Gallery thumbnail (small):** subtle camera icon overlay in the corner. Hover/tap surfaces the photographer name in a tooltip.
- **Photo lightbox (expanded):** photographer name as a credit line below the image ("Photo by David Johnson."). Attribution note shown beneath it, only when present, in muted secondary text.

**USER-source photos:** caption displays only if set. No "uploaded by [user]" attribution shown publicly (privacy precedent from `Review.userId SetNull` + denormalized `Review.userName`).

## API endpoints

**New:**
- `POST /api/admin/photos/archive` — multipart, admin-gated via `canCurateArchive`. Body: file + `photographerName` + `attributionNote` + `plantId` + optional `caption`. Creates `PlantPhoto` with `source='ARCHIVE'`.
- `PATCH /api/plants/:id/primary-photo` — body `{ photoId }`. Resource-aware gated via `canSetCoverPhoto`. Updates `Plant.primaryPhotoId`. No UI calls it yet; included because the helper exists and the route is trivial — sets up the future cover-photo feature with no extra work.

**Updated:**
- `POST /api/plants/:id/photos` — now requires `affirmedOwnWork: true` in the body. 400s if absent or false. Creates `PlantPhoto` with `source='USER'`.
- `DELETE /api/photos/:id` — uses `canDeletePhoto(user, photo)` helper.
- All endpoints returning plants in their response payload include `primaryPhoto` (FK-joined PlantPhoto) instead of `imageUrl` / `thumbnailUrl` directly.

**No change:** better-auth routes, List/UserPlant/Review endpoints.

## Testing strategy

Violetteer doesn't have an automated test suite yet. This design proposes two layers rather than standing up Jest/Vitest infrastructure for one feature:

**Layer 1 — manual verification script:** `scripts/verify-photo-migration.js`
- Counts: PlantPhoto rows by `source`; Plants with `primaryPhotoId IS NULL`; orphaned PlantPhoto rows.
- Sanity sample: 10 random plants, prints `Plant.id`, `primaryPhoto.imageUrl`, expected URL from old `Plant.imageUrl`. (Must run *before* Step 4 drops the old columns.)
- Run order: after Step 2 (data migration), before Step 3 (frontend refactor).

**Layer 2 — manual smoke checklist** (included in the implementation plan):

- [ ] Catalog grid loads with thumbnails
- [ ] Plant detail gallery shows attribution overlay for archive photos
- [ ] Lightbox expand shows credit line for archive photos
- [ ] Logged-out user can browse but not upload
- [ ] Logged-in user upload flow: checkbox required; submit disabled until checked
- [ ] User upload creates `source='USER'` row
- [ ] Admin sees "Upload archive photo" button; non-admin does not
- [ ] Admin archive upload requires photographer name + attribution note
- [ ] Admin archive upload creates `source='ARCHIVE'` row
- [ ] Direct API call without `affirmedOwnWork` is rejected (curl-level check)
- [ ] Deleting own user photo works; another user's photo gets 403
- [ ] Deleting a primary photo nulls `Plant.primaryPhotoId`; fallback works in UI

When CI/CD lands per the beta-readiness scorecard, most of these become Vitest + supertest cases trivially.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Migration script fails mid-run, leaves DB inconsistent | Pre-run `pg_dump`; idempotency rule (skip plants with `primaryPhotoId` set); `--dry-run` flag |
| Frontend refactor lands before data script runs → broken images | Expand-then-contract ordering (Steps 1→2→3→4) ensures frontend changes happen after `primaryPhoto` is populated and before old columns drop |
| Old columns dropped (Step 4) but a stale browser tab tries to read them | Single-developer dev environment; refresh fixes it. Documented constraint of solo deploys. |
| `primaryPhoto` null for a plant with no photos | UI shows placeholder (existing pattern). |
| Schema cycle (Plant↔PlantPhoto FK) confuses Prisma | Named relations (`PlantPrimaryPhoto`, `PlantAllPhotos`); verified via `prisma generate` before any data work |
| Admin uploads sensitive PII in attribution note | Free-text field, no validation — accepted risk; curator-only input, not user-facing |
| Hot-path catalog grid query slows down post-migration | `primaryPhotoId` is a direct FK join (one indexed lookup per row); benchmark vs. current `Plant.thumbnailUrl` before declaring done |

## Out of scope

- Account deletion + GDPR export (next brainstorm)
- Hybridizer identity verification
- Role expansion (USER / CURATOR / HYBRIDIZER / ADMIN)
- Cover photo selection UI
- In-app submission queue replacing the `hello@violetteer.com` redirect
- License-type enum / structured permission fields
- Bulk archive upload

## References

- Memory: `reference_beta_readiness.md` — beta scorecard
- Memory: `reference_local_db_baseline.md` — DB baseline + backup conventions
- Memory: `feedback_npm_install_workflow.md` — install discipline
- Schema: `prisma/schema.prisma`
- Source data: `~/Documents/FirstClass/avml.db` (`credits` table; 10,343 rows, ~588 unique photographers)
- Source data: `~/Documents/FirstClass/photos/` (10,223 jpgs)
