-- ============================================================
-- Migration: drop_is_in_catalog
--
-- Removes the Plant.isInCatalog field, which became dead weight
-- after the UserPlant refactor (20260307201829_add_user_plant).
--
-- Pre-flight context:
--   * All Plant rows now have isInCatalog = true (verified before
--     this migration). The 4 leftover isInCatalog=false rows were
--     deleted in a separate cleanup; their data was already in
--     UserPlant from the user_plant migration.
--   * All code references to isInCatalog (server/index.js, seed.js)
--     have been removed in the same commit as this migration.
--   * The guarded prisma/generate-*.js scripts still reference
--     isInCatalog under their stale-schema fast-fail guards; those
--     references are dead code and will be cleaned up when each
--     script is rewritten for the post-UserPlant schema.
-- ============================================================

ALTER TABLE "Plant" DROP COLUMN "isInCatalog";
