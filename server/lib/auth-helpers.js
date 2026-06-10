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
