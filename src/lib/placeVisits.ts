/**
 * Visit counts for the My list and Me screens. A visit is a "Let's go!" tap, which
 * the favourites store counts in `visitCount`. Pure helpers, no DOM.
 */
import type { FavouriteEntry } from '@/types/favourites';

type VisitEntry = Pick<FavouriteEntry, 'id' | 'restaurant' | 'visitCount' | 'userRating' | 'lastVisitedAt'>;

export const MOST_VISITED_LIMIT = 3;

const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

export interface MostVisitedPlace {
  id: string;
  name: string;
  visitCount: number;
}

/**
 * Top places by visit count, most visited first. Places never visited and places marked
 * "don't suggest" are left out. Ties go to the more recent visit, then to the name,
 * so the order does not jump around between renders.
 */
export const rankMostVisited = (
  entries: readonly VisitEntry[],
  limit: number = MOST_VISITED_LIMIT,
): MostVisitedPlace[] => (
  entries
    .filter((entry) => entry.visitCount > 0 && entry.userRating !== 'avoid')
    .sort((a, b) => (
      b.visitCount - a.visitCount
      || (b.lastVisitedAt ?? 0) - (a.lastVisitedAt ?? 0)
      || a.restaurant.name.localeCompare(b.restaurant.name)
    ))
    .slice(0, Math.max(0, limit))
    .map((entry) => ({ id: entry.id, name: entry.restaurant.name, visitCount: entry.visitCount }))
);

/**
 * Visits per place name. A list entry typed by hand has no place id, so it is matched to
 * favourites by name (ignoring case and extra spaces). Entries with the same name add up.
 */
export const buildVisitCountsByName = (entries: readonly VisitEntry[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.visitCount <= 0) continue;
    const key = normalizeName(entry.restaurant.name);
    counts.set(key, (counts.get(key) ?? 0) + entry.visitCount);
  }
  return counts;
};

export const getVisitCountForName = (counts: ReadonlyMap<string, number>, name: string): number => (
  counts.get(normalizeName(name)) ?? 0
);

/** "1 visit", "9 visits", or "Not visited yet". */
export const formatVisitCount = (count: number): string => {
  if (count <= 0) return 'Not visited yet';
  return count === 1 ? '1 visit' : `${count} visits`;
};
