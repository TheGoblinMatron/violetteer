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
