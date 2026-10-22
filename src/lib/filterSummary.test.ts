import { describe, expect, it } from 'vitest';

import {
  buildFilterButtonLabel,
  buildFilterSummary,
  buildShowPlacesLabel,
  countActiveFilters,
  formatPlaceCount,
  RANGE_SHORT_LABEL,
} from './filterSummary';

describe('formatPlaceCount', () => {
  it('pluralises', () => {
    expect(formatPlaceCount(0)).toBe('0 places');
    expect(formatPlaceCount(1)).toBe('1 place');
    expect(formatPlaceCount(24)).toBe('24 places');
  });
});

describe('buildFilterSummary', () => {
  it('joins the range and the count', () => {
    expect(buildFilterSummary('drive10', 24, false)).toBe('Filters · Drive 10 · 24 places');
    expect(buildFilterSummary('walk', 1, false)).toBe('Filters · Walk · 1 place');
    expect(buildFilterSummary('drive20', 0, false)).toBe('Filters · Drive 20 · 0 places');
  });

  it('shows a searching marker instead of a stale count while loading', () => {
    expect(buildFilterSummary('drive10', 24, true)).toBe('Filters · Drive 10 · searching…');
  });

  it('leaves the count out when there is no location yet', () => {
    expect(buildFilterSummary('drive10', null, false)).toBe('Filters · Drive 10');
  });

  it('has a short label for every range mode', () => {
    expect(Object.keys(RANGE_SHORT_LABEL).sort()).toEqual(['drive10', 'drive20', 'walk']);
  });
});

describe('buildShowPlacesLabel', () => {
  it('reports the real count', () => {
    expect(buildShowPlacesLabel(9, false)).toBe('Show 9 places');
    expect(buildShowPlacesLabel(1, false)).toBe('Show 1 place');
  });

  it('does not offer to show nothing', () => {
    expect(buildShowPlacesLabel(0, false)).toBe('No places match');
  });

  it('says so while searching, and falls back to Done with no count', () => {
    expect(buildShowPlacesLabel(9, true)).toBe('Finding places…');
    expect(buildShowPlacesLabel(null, false)).toBe('Done');
  });
});

describe('countActiveFilters', () => {
  it('adds categories, prices and serves filters', () => {
    expect(countActiveFilters({ categories: [], priceRanges: [], servesFilters: [] })).toBe(0);
    expect(
      countActiveFilters({ categories: ['rice', 'soup'], priceRanges: ['$$'], servesFilters: ['takeout'] }),
    ).toBe(4);
  });
});

describe('buildFilterButtonLabel', () => {
  it('appends the active filter count only when there is one', () => {
    expect(buildFilterButtonLabel('Filters · Walk · 3 places', 0)).toBe('Filters · Walk · 3 places');
    expect(buildFilterButtonLabel('Filters · Walk · 3 places', 1)).toBe('Filters · Walk · 3 places, 1 filter on');
    expect(buildFilterButtonLabel('Filters · Walk · 3 places', 3)).toBe('Filters · Walk · 3 places, 3 filters on');
  });
});
