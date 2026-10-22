/**
 * The coloured initial tile shown next to a place on the My list and Me screens.
 * Pure helpers so the rules can be unit-tested without a DOM.
 */

/** Arcade colours a tile can take. Map each to a class where the tile is drawn. */
export const PLACE_TILE_COLORS = ['pink', 'cyan', 'lime', 'orange', 'violet'] as const;

export type PlaceTileColor = (typeof PLACE_TILE_COLORS)[number];

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * First letter or digit of the name, upper-cased. Skips leading punctuation and
 * emoji so "(Kheng) Cafe" gives "K". Falls back to the first character, then "?".
 */
export const getPlaceInitial = (name: string): string => {
  const characters = Array.from(name.trim());
  if (characters.length === 0) return '?';

  const firstWordCharacter = characters.find((character) => /[\p{L}\p{N}]/u.test(character));
  return (firstWordCharacter ?? characters[0]).toLocaleUpperCase();
};

/**
 * Stable colour for a name. The same place always gets the same colour, and
 * case or extra spaces do not change it.
 */
export const getPlaceTileColor = (name: string): PlaceTileColor => {
  const normalized = normalizeName(name);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (Math.imul(hash, 31) + normalized.charCodeAt(index)) >>> 0;
  }
  return PLACE_TILE_COLORS[hash % PLACE_TILE_COLORS.length];
};
