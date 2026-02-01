/**
 * plantDescription.js - Helper for generating plant description strings
 *
 * Format: "<Name> (<regNum>) MM/DD/YYYY (<hybridizer>) <blossom>. <foliage>. <habit>."
 *
 * This is computed once when a plant is created/updated and stored in the database
 * to avoid recomputing it for every plant in every list render.
 */

/**
 * Format date from YYYY-MM-DD to MM/DD/YYYY
 * @param {string|null} dateStr - Date in YYYY-MM-DD format
 * @returns {string} Date in MM/DD/YYYY format, or empty string if invalid
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Strip trailing period and whitespace from a string
 * @param {string|null} str - Input string
 * @returns {string} String without trailing period
 */
function stripTrailingPeriod(str) {
  return str?.replace(/\.\s*$/, '') || '';
}

/**
 * Generate a formatted description string for a plant
 *
 * @param {Object} plant - Plant object with name, regNum, regDate, hybridizer, blossom, foliage, habit
 * @returns {string} Formatted description string
 *
 * @example
 * // Returns: "Rob's Sticky Wicket (10234) 01/15/2010 (R. Robinson) Double dark red. Variegated dark green and white, plain. Semiminiature."
 * generateDescription({
 *   name: "Rob's Sticky Wicket",
 *   regNum: "10234",
 *   regDate: "2010-01-15",
 *   hybridizer: "R. Robinson",
 *   blossom: "Double dark red.",
 *   foliage: "Variegated dark green and white, plain.",
 *   habit: "Semiminiature."
 * });
 */
export function generateDescription(plant) {
  if (!plant) return '';

  const parts = [];

  // Name with optional regNum
  let namePart = plant.name;
  if (plant.regNum) namePart += ` (${plant.regNum})`;
  parts.push(namePart);

  // RegDate in MM/DD/YYYY format
  if (plant.regDate) parts.push(formatDate(plant.regDate));

  // Hybridizer in parens
  if (plant.hybridizer) parts.push(`(${plant.hybridizer})`);

  // Join with spaces
  let desc = parts.join(' ');

  // Add blossom, foliage, habit - strip existing periods, then join with '. '
  const traits = [plant.blossom, plant.foliage, plant.habit]
    .filter(Boolean)
    .map(stripTrailingPeriod);

  if (traits.length > 0) {
    desc += ' ' + traits.join('. ') + '.';
  }

  return desc;
}
