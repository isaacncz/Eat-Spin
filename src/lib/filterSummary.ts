import type { AutoRangeMode } from '@/contexts/AppContext';
import type { Restaurant } from '@/types';

/**
 * Pure text and count helpers for the Spin screen's Filters button and the Filters
 * sheet. Kept free of React so they can be unit tested without a DOM.
 */

/** Short range names used on the Spin screen ("Drive 10"). */
export const RANGE_SHORT_LABEL: Record<AutoRangeMode, string> = {
  walk: 'Walk',
  drive10: 'Drive 10',
  drive20: 'Drive 20',
};

/** The most cuisines the nearby search and the sheet allow at once. */
export const MAX_CATEGORY_SELECTION = 3;

export const formatPlaceCount = (count: number): string =>
  `${count} ${count === 1 ? 'place' : 'places'}`;

/**
 * One-line text of the Filters button: "Filters · Drive 10 · 24 places".
 * `placeCount` is null while there is no location yet (nothing to count).
 */
export const buildFilterSummary = (
  rangeMode: AutoRangeMode,
  placeCount: number | null,
  isLoading: boolean,
): string => {
  const parts = ['Filters', RANGE_SHORT_LABEL[rangeMode]];
  if (isLoading) parts.push('searching…');
  else if (placeCount !== null) parts.push(formatPlaceCount(placeCount));
  return parts.join(' · ');
};

/** Label of the sheet's pinned button: "Show 9 places". */
export const buildShowPlacesLabel = (placeCount: number | null, isLoading: boolean): string => {
  if (isLoading) return 'Finding places…';
  if (placeCount === null) return 'Done';
  if (placeCount === 0) return 'No places match';
  return `Show ${formatPlaceCount(placeCount)}`;
};

interface ActiveFilterInput {
  categories: readonly string[];
  priceRanges: readonly Restaurant['priceRange'][];
  servesFilters: readonly string[];
}

/** How many optional filters are on (the range always has a value, so it is not counted). */
export const countActiveFilters = ({ categories, priceRanges, servesFilters }: ActiveFilterInput): number =>
  categories.length + priceRanges.length + servesFilters.length;

/** Accessible name of the Filters button: the visible text plus how many filters are on. */
export const buildFilterButtonLabel = (summary: string, activeCount: number): string =>
  activeCount > 0 ? `${summary}, ${activeCount} ${activeCount === 1 ? 'filter' : 'filters'} on` : summary;
