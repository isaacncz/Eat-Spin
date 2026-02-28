// Restaurant utilities for dynamic ID generation and radius filtering

import type { Restaurant, FoodCategory } from '@/types';

export type RangeMode = 'walk' | 'drive10' | 'drive20';

export interface FilterResult {
  results: Restaurant[];
  expanded: boolean;
  expandedLabel?: string;
}

type FilterCacheEntry = {
  value: FilterResult;
  expiresAt: number;
};

const FILTER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_FILTER_CACHE_ENTRIES = 200;
const filterCache = new Map<string, FilterCacheEntry>();

// Exclusive distance bands: primary min (exclusive), max (inclusive)
// walk: 0 ≤ d ≤ 1.2  (no lower exclusive bound)
// drive10 primary: 1.2 < d ≤ 6
// drive20 primary: 6 < d ≤ 12
const RANGE_BAND_MIN_KM: Record<RangeMode, number> = { walk: 0, drive10: 1.2, drive20: 6 };
const RANGE_BAND_MAX_KM: Record<RangeMode, number> = { walk: 1.2, drive10: 6, drive20: 12 };
const SPARSE_THRESHOLD = 12;

const serializeSorted = (values: string[]): string => [...values].sort().join('|');

const toBucket = (value: number, precision: number = 4): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const buildFilterCacheKey = (
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  rangeMode: RangeMode,
  selectedPriceRanges: Restaurant['priceRange'][],
  halalFriendlyOnly: boolean
): string => {
  const locationKey = userLocation
    ? `${toBucket(userLocation.lat)}:${toBucket(userLocation.lng)}`
    : 'no-location';

  return [
    locationKey,
    rangeMode,
    serializeSorted(selectedCategories),
    serializeSorted(selectedPriceRanges),
    halalFriendlyOnly ? 'halal-friendly' : 'all',
  ].join('::');
};

const readFilterCache = (key: string): FilterResult | null => {
  const entry = filterCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    filterCache.delete(key);
    return null;
  }

  return entry.value;
};

const writeFilterCache = (key: string, value: FilterResult): void => {
  if (filterCache.size >= MAX_FILTER_CACHE_ENTRIES) {
    const oldestKey = filterCache.keys().next().value;
    if (oldestKey) {
      filterCache.delete(oldestKey);
    }
  }

  filterCache.set(key, {
    value,
    expiresAt: Date.now() + FILTER_CACHE_TTL_MS,
  });
};

const nonHalalCategories: FoodCategory[] = ['chinese', 'japanese', 'korean', 'western'];

/**
 * Heuristic to determine if a restaurant should be considered non-halal.
 * This can be replaced with explicit restaurant metadata in the future.
 */
export const isNonHalalRestaurant = (restaurant: Restaurant): boolean => {
  return restaurant.category.some((category) => nonHalalCategories.includes(category as FoodCategory));
};

/**
 * Generate a unique ID for a restaurant based on its position in the array
 * @param index - The index of the restaurant in the array
 * @returns A string ID in the format 'restaurant-{index}'
 */
export const generateRestaurantId = (index: number): string => {
  return `restaurant-${index}`;
};

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lon1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lon2 - Longitude of point 2
 * @returns Distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Filter restaurants by radius from a given location
 * @param restaurants - Array of restaurants to filter
 * @param userLocation - User's current location (lat, lng)
 * @param radiusKm - Maximum distance in kilometers
 * @returns Filtered array of restaurants within the radius
 */
export const filterByRadius = (
  restaurants: Restaurant[],
  userLocation: { lat: number; lng: number } | null,
  radiusKm: number
): Restaurant[] => {
  if (!userLocation) {
    return restaurants;
  }

  return restaurants.filter((restaurant) => {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      restaurant.coordinates.lat,
      restaurant.coordinates.lng
    );
    return distance <= radiusKm;
  });
};

/**
 * Enhanced restaurant filter that includes exclusive distance-band filtering with sparse auto-expand.
 * Filter order: category → price → halal-friendly → distance band (with sparse expansion).
 * @param restaurants - Pool of restaurants (already fetched at the widest radius for the mode)
 * @param userLocation - User's current location
 * @param selectedCategories - Selected food categories
 * @param rangeMode - Range mode (walk / drive10 / drive20)
 * @param selectedPriceRanges - Selected price ranges
 * @param halalFriendlyOnly - When true, exclude heuristic non-halal restaurants
 * @returns FilterResult with results array and expansion metadata
 */
export const enhancedFilterRestaurants = (
  restaurants: Restaurant[],
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  rangeMode: RangeMode,
  selectedPriceRanges: Restaurant['priceRange'][] = [],
  halalFriendlyOnly = false
): FilterResult => {
  const cacheKey = buildFilterCacheKey(
    userLocation,
    selectedCategories,
    rangeMode,
    selectedPriceRanges,
    halalFriendlyOnly
  );

  const cached = readFilterCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Category filter
  let filtered = restaurants;

  if (selectedCategories.length > 0) {
    filtered = filtered.filter((restaurant) =>
      restaurant.category.some((category) => selectedCategories.includes(category as FoodCategory))
    );
  }

  // 2. Price filter: when chips active, exclude unknown-price restaurants
  if (selectedPriceRanges.length > 0) {
    filtered = filtered.filter((restaurant) => {
      if (restaurant.hasKnownPriceRange === false) return false;
      return selectedPriceRanges.includes(restaurant.priceRange);
    });
  }

  // 3. Halal-friendly filter: `isNonHalalRestaurant` returns true for heuristically non-halal
  //    restaurants; negating it keeps only halal-friendly ones.
  if (halalFriendlyOnly) {
    filtered = filtered.filter((restaurant) => !isNonHalalRestaurant(restaurant));
  }

  // 4. Attach computed distances
  const withDistance = userLocation
    ? filtered.map((restaurant) => ({
        ...restaurant,
        distance: restaurant.distance ?? calculateDistance(
          userLocation.lat,
          userLocation.lng,
          restaurant.coordinates.lat,
          restaurant.coordinates.lng
        ),
      }))
    : filtered;

  // 5. Distance band filtering with sparse auto-expand
  let results: Restaurant[];
  let expanded = false;
  let expandedLabel: string | undefined;

  if (!userLocation) {
    results = withDistance;
  } else {
    const maxKm = RANGE_BAND_MAX_KM[rangeMode];
    const minKm = RANGE_BAND_MIN_KM[rangeMode];

    if (rangeMode === 'walk') {
      // Walk: strict 0–1.2 km, no expansion
      results = withDistance.filter((r) => (r.distance ?? 0) <= maxKm);
    } else if (rangeMode === 'drive10') {
      // Primary band: >1.2–6 km
      const primary = withDistance.filter((r) => {
        const d = r.distance ?? 0;
        return d > minKm && d <= maxKm;
      });
      if (primary.length >= SPARSE_THRESHOLD) {
        results = primary;
      } else {
        // Expand inward to 0–6 km
        results = withDistance.filter((r) => (r.distance ?? 0) <= maxKm);
        expanded = true;
        expandedLabel = `${results.length} nearby spot${results.length === 1 ? '' : 's'} found — try a wider range for more options.`;
      }
    } else {
      // drive20 primary band: >6–12 km
      const primary = withDistance.filter((r) => {
        const d = r.distance ?? 0;
        return d > minKm && d <= maxKm;
      });
      if (primary.length >= SPARSE_THRESHOLD) {
        results = primary;
      } else {
        // Expand 1: >1.2–12 km
        const expand1 = withDistance.filter((r) => {
          const d = r.distance ?? 0;
          return d > 1.2 && d <= maxKm;
        });
        if (expand1.length >= SPARSE_THRESHOLD) {
          results = expand1;
          expanded = true;
          expandedLabel = `${results.length} nearby spot${results.length === 1 ? '' : 's'} found — try a wider range for more options.`;
        } else {
          // Expand 2: 0–12 km
          results = withDistance.filter((r) => (r.distance ?? 0) <= maxKm);
          expanded = true;
          expandedLabel = `${results.length} nearby spot${results.length === 1 ? '' : 's'} found — try a wider range for more options.`;
        }
      }
    }

    // Sort by distance ascending
    results = [...results].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  const filterResult: FilterResult = { results, expanded, expandedLabel };
  writeFilterCache(cacheKey, filterResult);
  return filterResult;
};
