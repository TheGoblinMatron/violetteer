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
