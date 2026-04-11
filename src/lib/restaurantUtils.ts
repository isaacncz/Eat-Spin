// Restaurant utilities for dynamic ID generation, opening-hours checks, and radius filtering

import type { Restaurant, FoodCategory, DailyHours, TimeWindow } from '@/types';

export type RangeMode = 'walk' | 'drive10' | 'drive20';
export type HalalFilter = 'all' | 'halal' | 'non-halal';

export interface FilterResult {
  results: Restaurant[];
  expanded: boolean;
  expandedLabel?: string;
  closedNowExcludedCount: number;
  closingSoonExcludedCount: number;
}

export interface RestaurantOpenStatus {
  isOpenNow: boolean;
  activeWindow: TimeWindow | null;
  minutesUntilClose: number | null;
}

type FilterCacheEntry = {
  value: FilterResult;
  expiresAt: number;
};

const FILTER_CACHE_TTL_MS = 5 * 60 * 1000;
const EMPTY_FILTER_CACHE_TTL_MS = 10 * 1000;
const MAX_FILTER_CACHE_ENTRIES = 200;
const filterCache = new Map<string, FilterCacheEntry>();

// Exclusive distance bands: primary min (exclusive), max (inclusive)
// Radii are tightened by ~1.4× detour factor so straight-line
// distance better approximates actual road travel time.
// walk: 0 ≤ d ≤ 0.85      (~12 min walk)
// drive10 primary: 0.85 < d ≤ 4.3  (~10 min drive)
// drive20 primary: 4.3 < d ≤ 8.5   (~20 min drive)
const RANGE_BAND_MIN_KM: Record<RangeMode, number> = { walk: 0, drive10: 0.85, drive20: 4.3 };
const RANGE_BAND_MAX_KM: Record<RangeMode, number> = { walk: 0.85, drive10: 4.3, drive20: 8.5 };
const SPARSE_THRESHOLD = 12;
const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const AUTO_RESULT_SOURCES = new Set<NonNullable<Restaurant['source']>>([
  'google-live',
  'google-cache',
  'local-fallback',
]);

// Quality gate: minimum thresholds for curated results
// Places below these are excluded from the wheel entirely.
const MIN_QUALITY_RATING = 3.8;
const MIN_QUALITY_REVIEWS = 15;
// Auto-spin keeps a small safety buffer so users do not land on a place
// that is about to shut down. Change this to `60` for a 1-hour cutoff.
export const AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF = 30;

/**
 * Bayesian-weighted quality score that balances rating with review volume.
 *
 * Uses a simplified Wilson-like formula:
 *   score = rating × log10(max(reviewCount, 1) + 1)
 *
 * This ensures:
 * - A 5.0★ / 2-review place scores ~2.4
 * - A 4.5★ / 50-review scores ~7.7  (much higher — preferred)
 * - A 4.2★ / 500-review scores ~11.3 (proven popular — wins)
 *
 * The score is used for ranking, not filtering.
 */
export const computeQualityScore = (rating: number, userRatingCount: number): number => {
  return rating * Math.log10(Math.max(userRatingCount, 1) + 1);
};

const serializeSorted = (values: string[]): string => [...values].sort().join('|');

const toBucket = (value: number, precision: number = 4): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const buildRestaurantPoolSignature = (restaurants: Restaurant[], dataVersion?: string): string => {
  if (dataVersion) {
    return `version:${dataVersion}`;
  }

  const sortedIds = restaurants.map((restaurant) => restaurant.id).sort();
  return `count:${sortedIds.length}:ids:${hashString(sortedIds.join('|'))}`;
};

const buildFilterCacheKey = (
  restaurants: Restaurant[],
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  rangeMode: RangeMode,
  selectedPriceRanges: Restaurant['priceRange'][],
  halalFilter: HalalFilter,
  dataVersion?: string,
  avoidedRestaurantIds?: Set<string>,
): string => {
  const locationKey = userLocation
    ? `${toBucket(userLocation.lat)}:${toBucket(userLocation.lng)}`
    : 'no-location';
  const poolSignature = buildRestaurantPoolSignature(restaurants, dataVersion);
  const avoidedKey = avoidedRestaurantIds && avoidedRestaurantIds.size > 0
    ? `avoided:${[...avoidedRestaurantIds].sort().join(',')}`
    : 'no-avoided';

  return [
    poolSignature,
    locationKey,
    rangeMode,
    serializeSorted(selectedCategories),
    serializeSorted(selectedPriceRanges),
    halalFilter,
    avoidedKey,
    `close-cutoff:${AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF}`,
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

const writeFilterCache = (key: string, value: FilterResult, options?: { sourcePoolSize: number }): void => {
  if ((options?.sourcePoolSize ?? 0) === 0) {
    return;
  }

  if (filterCache.size >= MAX_FILTER_CACHE_ENTRIES) {
    const oldestKey = filterCache.keys().next().value;
    if (oldestKey) {
      filterCache.delete(oldestKey);
    }
  }

  filterCache.set(key, {
    value,
    expiresAt: Date.now() + (value.results.length === 0 ? EMPTY_FILTER_CACHE_TTL_MS : FILTER_CACHE_TTL_MS),
  });
};

export const __resetFilterCacheForTests = (): void => {
  filterCache.clear();
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

const getDayKey = (date: Date, offset: number = 0): string => {
  const index = (date.getDay() + offset + 7) % 7;
  return dayKeys[index];
};

const resolveDayHours = (hours: Restaurant['hours'], dayKey: string): DailyHours | undefined => {
  return hours[dayKey] ?? hours.daily ?? Object.values(hours)[0];
};

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const isOpenInTodayWindow = (currentMinutes: number, openMinutes: number, closeMinutes: number): boolean => {
  if (openMinutes <= closeMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes;
};

const isOpenFromPreviousDayOvernight = (
  currentMinutes: number,
  openMinutes: number,
  closeMinutes: number
): boolean => {
  if (openMinutes <= closeMinutes) {
    return false;
  }

  return currentMinutes <= closeMinutes;
};

const findActiveWindow = (
  dayHours: DailyHours | undefined,
  currentMinutes: number,
  matcher: (currentMinutes: number, openMinutes: number, closeMinutes: number) => boolean
): TimeWindow | null => {
  if (!dayHours || dayHours.closed || dayHours.windows.length === 0) {
    return null;
  }

  return dayHours.windows.find((window) => {
    const openMinutes = toMinutes(window.open);
    const closeMinutes = toMinutes(window.close);
    return matcher(currentMinutes, openMinutes, closeMinutes);
  }) ?? null;
};

const getMinutesUntilClose = (
  activeWindow: TimeWindow,
  currentMinutes: number,
  sourceDay: 'today' | 'previous-day'
): number => {
  const openMinutes = toMinutes(activeWindow.open);
  const closeMinutes = toMinutes(activeWindow.close);

  if (openMinutes <= closeMinutes) {
    return closeMinutes - currentMinutes;
  }

  if (sourceDay === 'today') {
    return (24 * 60 - currentMinutes) + closeMinutes;
  }

  return closeMinutes - currentMinutes;
};

export const getRestaurantOpenStatus = (
  hours: Restaurant['hours'],
  now: Date = new Date()
): RestaurantOpenStatus => {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayHours = resolveDayHours(hours, getDayKey(now));
  const previousDayHours = resolveDayHours(hours, getDayKey(now, -1));

  const activeTodayWindow = findActiveWindow(todayHours, currentMinutes, isOpenInTodayWindow);
  if (activeTodayWindow) {
    return {
      isOpenNow: true,
      activeWindow: activeTodayWindow,
      minutesUntilClose: getMinutesUntilClose(activeTodayWindow, currentMinutes, 'today'),
    };
  }

  const activePreviousDayWindow = findActiveWindow(
    previousDayHours,
    currentMinutes,
    isOpenFromPreviousDayOvernight
  );
  if (activePreviousDayWindow) {
    return {
      isOpenNow: true,
      activeWindow: activePreviousDayWindow,
      minutesUntilClose: getMinutesUntilClose(activePreviousDayWindow, currentMinutes, 'previous-day'),
    };
  }

  return {
    isOpenNow: false,
    activeWindow: null,
    minutesUntilClose: null,
  };
};

export const isRestaurantOpen = (hours: Restaurant['hours']): boolean => {
  return getRestaurantOpenStatus(hours).isOpenNow;
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
 * Filter order: category → price → halal filter → distance band (with sparse expansion).
 * @param restaurants - Pool of restaurants (already fetched at the widest radius for the mode)
 * @param userLocation - User's current location
 * @param selectedCategories - Selected food categories
 * @param rangeMode - Range mode (walk / drive10 / drive20)
 * @param selectedPriceRanges - Selected price ranges
 * @param halalFilter - 'halal' keeps only halal-friendly restaurants; 'non-halal' keeps only non-halal; 'all' shows all
 * @param dataVersion - optional data version string for cache keying
 * @param avoidedRestaurantIds - optional set of restaurant IDs (googlePlaceId or derived favourite IDs) to exclude (user marked 'avoid')
 * @returns FilterResult with results array and expansion metadata
 */
export const enhancedFilterRestaurants = (
  restaurants: Restaurant[],
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  rangeMode: RangeMode,
  selectedPriceRanges: Restaurant['priceRange'][] = [],
  halalFilter: HalalFilter = 'all',
  dataVersion?: string,
  avoidedRestaurantIds?: Set<string>,
): FilterResult => {
  const cacheKey = buildFilterCacheKey(
    restaurants,
    userLocation,
    selectedCategories,
    rangeMode,
    selectedPriceRanges,
    halalFilter,
    dataVersion,
    avoidedRestaurantIds,
  );

  const cached = readFilterCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 0. Quality gate: exclude poorly reviewed places to keep the wheel curated.
  //    Local fallback restaurants skip this gate (they don't have real review counts).
  let filtered = restaurants.filter((restaurant) => {
    if (restaurant.source === 'local-fallback') return true;
    if (restaurant.rating < MIN_QUALITY_RATING) return false;
    if ((restaurant.userRatingCount ?? 0) < MIN_QUALITY_REVIEWS) return false;
    return true;
  });

  // 0b. Exclude restaurants the user has marked as 'avoid' in favourites.
  if (avoidedRestaurantIds && avoidedRestaurantIds.size > 0) {
    filtered = filtered.filter((restaurant) => {
      // Check both the restaurant's googlePlaceId and its raw id
      if (restaurant.googlePlaceId && avoidedRestaurantIds.has(restaurant.googlePlaceId)) return false;
      if (avoidedRestaurantIds.has(restaurant.id)) return false;
      return true;
    });
  }

  // 1. Category filter
  if (selectedCategories.length > 0) {
    filtered = filtered.filter((restaurant) =>
      restaurant.category.some((category) => selectedCategories.includes(category as FoodCategory))
    );

    // 1b. Confidence gate: when the user has selected specific cuisines,
    //     exclude low-confidence restaurants (weak/no classification signal).
    filtered = filtered.filter((restaurant) => {
      // Local fallback data is hand-curated — always trusted
      if (restaurant.source === 'local-fallback') return true;
      return restaurant.categoryConfidence !== 'low';
    });
  }

  // 2. Price filter: when chips active, exclude unknown-price restaurants
  if (selectedPriceRanges.length > 0) {
    filtered = filtered.filter((restaurant) => {
      if (restaurant.hasKnownPriceRange === false) return false;
      return selectedPriceRanges.includes(restaurant.priceRange);
    });
  }

  // 3. Halal filter: keep only halal-friendly or only non-halal restaurants
  if (halalFilter === 'halal') {
    filtered = filtered.filter((restaurant) => !isNonHalalRestaurant(restaurant));
  } else if (halalFilter === 'non-halal') {
    filtered = filtered.filter((restaurant) => isNonHalalRestaurant(restaurant));
  }

  let closedNowExcludedCount = 0;
  let closingSoonExcludedCount = 0;
  filtered = filtered.filter((restaurant) => {
    if (!restaurant.source || !AUTO_RESULT_SOURCES.has(restaurant.source)) {
      return true;
    }

    const openStatus = getRestaurantOpenStatus(restaurant.hours);
    if (!openStatus.isOpenNow) {
      closedNowExcludedCount += 1;
      return false;
    }

    if ((openStatus.minutesUntilClose ?? Number.POSITIVE_INFINITY) < AUTO_SPIN_MINUTES_UNTIL_CLOSE_CUTOFF) {
      closingSoonExcludedCount += 1;
      return false;
    }

    return true;
  });

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
      // drive20 primary band: >4.3–8.5 km
      const primary = withDistance.filter((r) => {
        const d = r.distance ?? 0;
        return d > minKm && d <= maxKm;
      });
      if (primary.length >= SPARSE_THRESHOLD) {
        results = primary;
      } else {
        // Expand 1: >0.85–8.5 km
        const expand1 = withDistance.filter((r) => {
          const d = r.distance ?? 0;
          return d > 0.85 && d <= maxKm;
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

  const filterResult: FilterResult = {
    results,
    expanded,
    expandedLabel,
    closedNowExcludedCount,
    closingSoonExcludedCount,
  };
  writeFilterCache(cacheKey, filterResult, { sourcePoolSize: restaurants.length });
  return filterResult;
};

// ---------------------------------------------------------------------------
// Favourites proximity helpers
// ---------------------------------------------------------------------------

export interface NearbyFavourite {
  favouriteId: string;
  restaurantName: string;
  distanceKm: number;
}

/**
 * Return favourites within `radiusKm` of the user, sorted by distance ascending.
 * Excludes entries with `userRating === 'avoid'`.
 */
export const findNearbyFavourites = (
  favourites: Array<{
    id: string;
    restaurant: { name: string; coordinates: { lat: number; lng: number } };
    userRating: string;
  }>,
  userLat: number,
  userLng: number,
  radiusKm: number = 1.5,
): NearbyFavourite[] => {
  return favourites
    .filter((f) => f.userRating !== 'avoid')
    .map((f) => ({
      favouriteId: f.id,
      restaurantName: f.restaurant.name,
      distanceKm: calculateDistance(
        userLat,
        userLng,
        f.restaurant.coordinates.lat,
        f.restaurant.coordinates.lng,
      ),
    }))
    .filter((f) => f.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
};

/**
 * Check if a restaurant on the wheel is also in the user's favourites.
 * Returns the matched FavouriteEntry id or null.
 */
export const matchFavourite = (
  restaurant: Restaurant,
  favouriteIds: Set<string>,
  favouriteGooglePlaceIds: Set<string>,
): boolean => {
  if (restaurant.googlePlaceId && favouriteGooglePlaceIds.has(restaurant.googlePlaceId)) return true;
  if (favouriteIds.has(restaurant.id)) return true;
  return false;
};
