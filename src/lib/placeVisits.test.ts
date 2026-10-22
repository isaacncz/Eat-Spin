import { describe, expect, it } from 'vitest';

import type { Restaurant } from '@/types';
import type { FavouriteEntry } from '@/types/favourites';
import {
  buildVisitCountsByName,
  formatVisitCount,
  getVisitCountForName,
  MOST_VISITED_LIMIT,
  rankMostVisited,
} from '@/lib/placeVisits';

const entry = (
  name: string,
  visitCount: number,
  extra: Partial<Pick<FavouriteEntry, 'userRating' | 'lastVisitedAt'>> = {},
): FavouriteEntry => ({
  id: `fav-${name}`,
  restaurant: { id: name, name, address: 'Penang' } as Restaurant,
  savedAt: 0,
  savedFrom: 'lets-go',
  location: { lat: 0, lng: 0 },
  visitCount,
  userRating: 'suggest',
  feedbackPending: false,
  ...extra,
});

describe('rankMostVisited', () => {
  it('returns the top three by visit count, most visited first', () => {
    const ranked = rankMostVisited([
      entry('Mee Hoon Corner', 1),
      entry('Nasi Kandar Pelita', 9),
      entry('Kheng Cafe', 3),
      entry('CKT Stall', 6),
      entry('Sup Tulang', 2),
    ]);

    expect(ranked.map((place) => place.name)).toEqual(['Nasi Kandar Pelita', 'CKT Stall', 'Kheng Cafe']);
    expect(ranked.map((place) => place.visitCount)).toEqual([9, 6, 3]);
    expect(ranked).toHaveLength(MOST_VISITED_LIMIT);
  });

  it('leaves out places that were never visited', () => {
    expect(rankMostVisited([entry('Saved only', 0), entry('Went once', 1)]).map((place) => place.name)).toEqual(['Went once']);
  });

  it("leaves out places marked don't suggest, but keeps neutral ones", () => {
    const ranked = rankMostVisited([
      entry('Avoided', 20, { userRating: 'avoid' }),
      entry('Neutral', 5, { userRating: 'neutral' }),
    ]);
    expect(ranked.map((place) => place.name)).toEqual(['Neutral']);
  });

  it('breaks ties by the more recent visit, then by name', () => {
    const ranked = rankMostVisited([
      entry('Banana Leaf', 4, { lastVisitedAt: 100 }),
      entry('Apple Stall', 4, { lastVisitedAt: 100 }),
      entry('Recent Place', 4, { lastVisitedAt: 500 }),
      entry('No Date', 4),
    ]);
    expect(ranked.map((place) => place.name)).toEqual(['Recent Place', 'Apple Stall', 'Banana Leaf']);
  });

  it('does not change the list it was given', () => {
    const entries = [entry('B', 1), entry('A', 5)];
    rankMostVisited(entries);
    expect(entries.map((item) => item.restaurant.name)).toEqual(['B', 'A']);
  });

  it('returns an empty list when there is nothing to rank', () => {
    expect(rankMostVisited([])).toEqual([]);
    expect(rankMostVisited([entry('A', 3)], 0)).toEqual([]);
  });
});

describe('visit counts by name', () => {
  const counts = buildVisitCountsByName([
    entry('Kheng Cafe', 3),
    entry('  kheng   CAFE', 2),
    entry('Never Went', 0),
  ]);

  it('matches a list entry to its favourite by name, ignoring case and spacing', () => {
    expect(getVisitCountForName(counts, 'KHENG CAFE')).toBe(5);
  });

  it('returns 0 for unknown places and places never visited', () => {
    expect(getVisitCountForName(counts, 'Somewhere Else')).toBe(0);
    expect(getVisitCountForName(counts, 'Never Went')).toBe(0);
  });
});

describe('formatVisitCount', () => {
  it('words the count', () => {
    expect(formatVisitCount(0)).toBe('Not visited yet');
    expect(formatVisitCount(1)).toBe('1 visit');
    expect(formatVisitCount(9)).toBe('9 visits');
  });
});
