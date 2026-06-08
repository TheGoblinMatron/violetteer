-- ============================================================
-- Migration: add_user_plant
--
-- Introduces the UserPlant model ("user-violet"), replacing the
-- pattern of storing user-owned plants as Plant rows with
-- isInCatalog: false.
--
-- Safe ordering within this transaction:
--   1. ADD new tables and columns (schema additions)
--   2. MIGRATE data (populate UserPlant, wire up ListPlant)
--   3. ENFORCE NOT NULL constraint on ListPlant.userPlantId
--   4. DROP old columns (schema removals)
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: Create the UserPlant table
--
-- _sourcePlantId is a temporary column used only during this
-- migration to track which original Plant row each custom
-- UserPlant came from. It allows exact ID-based matching in
-- step 3 rather than fuzzy name matching. Dropped in step 5.
-- ------------------------------------------------------------

CREATE TABLE "UserPlant" (
    "id"               SERIAL        NOT NULL,
    "userId"           TEXT          NOT NULL,
    "catalogPlantId"   INTEGER,
    "customName"       TEXT,
    "customHybridizer" TEXT,
    "customBlossom"    TEXT,
    "customFoliage"    TEXT,
    "customHabit"      TEXT,
    "customNotes"      TEXT,
    "dateAcquired"     TIMESTAMP(3),
    "sourceNotes"      TEXT,
    "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "_sourcePlantId"   INTEGER,      -- migration-only: tracks origin Plant.id for custom plants

    CONSTRAINT "UserPlant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserPlant_userId_idx"         ON "UserPlant"("userId");
CREATE INDEX "UserPlant_catalogPlantId_idx" ON "UserPlant"("catalogPlantId");

-- Foreign keys for UserPlant
ALTER TABLE "UserPlant"
    ADD CONSTRAINT "UserPlant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPlant"
    ADD CONSTRAINT "UserPlant_catalogPlantId_fkey"
    FOREIGN KEY ("catalogPlantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------
-- STEP 2: Add userPlantId column to ListPlant (nullable for now)
-- ------------------------------------------------------------

ALTER TABLE "ListPlant" ADD COLUMN "userPlantId" INTEGER;

-- ------------------------------------------------------------
-- STEP 3: Migrate data
--
-- 3a. Catalog plants (isInCatalog = true):
--     One UserPlant per (userId, plantId) pair, deduplicated
--     across lists. Notes carried from the earliest ListPlant.
--
-- 3b. Custom plants (isInCatalog = false):
--     One UserPlant per (userId, plantId) pair. If a user has
--     two custom plants with the same name, the second gets
--     " (1)" appended, the third " (2)", etc.
--     _sourcePlantId records the origin Plant.id for safe
--     matching in the ListPlant wiring step.
--
-- 3c. Wire up ListPlant.userPlantId using exact ID matching.
-- ------------------------------------------------------------

-- 3a. Catalog plants
WITH unique_catalog AS (
    SELECT DISTINCT ON (l."userId", lp."plantId")
        l."userId",
        lp."plantId",
        lp."notes"
    FROM "ListPlant" lp
    JOIN "List"  l ON l."id"  = lp."listId"
    JOIN "Plant" p ON p."id"  = lp."plantId"
    WHERE p."isInCatalog" = true
    ORDER BY l."userId", lp."plantId", lp."id"  -- earliest entry wins for notes
)
INSERT INTO "UserPlant" ("userId", "catalogPlantId", "customNotes", "createdAt", "updatedAt")
SELECT "userId", "plantId", "notes", NOW(), NOW()
FROM unique_catalog;

-- 3b. Custom plants — with duplicate-name detection and suffix appending
WITH unique_customs AS (
    -- One row per (userId, plantId); take notes from the earliest ListPlant entry
    SELECT DISTINCT ON (l."userId", lp."plantId")
        l."userId",
        lp."plantId"    AS "sourcePlantId",
        p."name",
        p."hybridizer",
        p."blossom",
        p."foliage",
        p."habit",
        lp."notes"
    FROM "ListPlant" lp
    JOIN "List"  l ON l."id" = lp."listId"
    JOIN "Plant" p ON p."id" = lp."plantId"
    WHERE p."isInCatalog" = false
    ORDER BY l."userId", lp."plantId", lp."id"
),
ranked AS (
    -- Rank duplicates within the same (userId, name) group.
    -- rank 1 keeps the original name; rank 2 becomes "Name (1)", etc.
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "name"
            ORDER BY "sourcePlantId"        -- lower plantId = original
        ) AS "nameRank"
    FROM unique_customs
)
INSERT INTO "UserPlant" (
    "userId", "catalogPlantId",
    "customName", "customHybridizer", "customBlossom", "customFoliage", "customHabit",
    "customNotes", "_sourcePlantId",
    "createdAt", "updatedAt"
)
SELECT
    "userId",
    NULL,           -- no catalog reference for custom plants
    CASE WHEN "nameRank" > 1
        THEN "name" || ' (' || ("nameRank" - 1)::text || ')'
        ELSE "name"
    END,
    "hybridizer",
    "blossom",
    "foliage",
    "habit",
    "notes",
    "sourcePlantId",
    NOW(),
    NOW()
FROM ranked;

-- 3c. Wire ListPlant → UserPlant for catalog plants
--     Match exactly on (userId, catalogPlantId).
--     Note: lp can only be referenced in WHERE, not in JOIN ON.
UPDATE "ListPlant" lp
SET "userPlantId" = up."id"
FROM "List" l
JOIN "UserPlant" up ON up."userId" = l."userId"
WHERE lp."listId" = l."id"
  AND up."catalogPlantId" = lp."plantId"
  AND up."catalogPlantId" IS NOT NULL;

-- 3d. Wire ListPlant → UserPlant for custom plants
--     Match exactly on (userId, _sourcePlantId) — no name ambiguity.
UPDATE "ListPlant" lp
SET "userPlantId" = up."id"
FROM "List" l
JOIN "UserPlant" up ON up."userId" = l."userId"
WHERE lp."listId" = l."id"
  AND up."_sourcePlantId" = lp."plantId"
  AND up."_sourcePlantId" IS NOT NULL;

-- ------------------------------------------------------------
-- STEP 4: Enforce NOT NULL on userPlantId now that every row
--         has been populated, then add the unique constraint.
-- ------------------------------------------------------------

ALTER TABLE "ListPlant" ALTER COLUMN "userPlantId" SET NOT NULL;

ALTER TABLE "ListPlant"
    ADD CONSTRAINT "ListPlant_userPlantId_fkey"
    FOREIGN KEY ("userPlantId") REFERENCES "UserPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ListPlant_listId_userPlantId_key" ON "ListPlant"("listId", "userPlantId");

-- ------------------------------------------------------------
-- STEP 5: Drop old columns and the migration-only temp column
-- ------------------------------------------------------------

DROP INDEX IF EXISTS "ListPlant_listId_plantId_key";

ALTER TABLE "ListPlant"
    DROP COLUMN "plantId",
    DROP COLUMN "notes";

-- Drop the temporary tracking column now that wiring is complete
ALTER TABLE "UserPlant" DROP COLUMN "_sourcePlantId";
