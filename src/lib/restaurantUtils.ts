// Restaurant utilities for dynamic ID generation and radius filtering

import type { Restaurant, FoodCategory } from '@/types';

type FilterCacheEntry = {
  value: Restaurant[];
  expiresAt: number;
};

const FILTER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_FILTER_CACHE_ENTRIES = 200;
const filterCache = new Map<string, FilterCacheEntry>();

const serializeSorted = (values: string[]): string => [...values].sort().join('|');

const toBucket = (value: number, precision: number = 4): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const buildFilterCacheKey = (
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  radiusKm: number,
  selectedPriceRanges: Restaurant['priceRange'][],
  nonHalalOnly: boolean
): string => {
  const locationKey = userLocation
    ? `${toBucket(userLocation.lat)}:${toBucket(userLocation.lng)}`
    : 'no-location';

  return [
    locationKey,
    radiusKm.toFixed(2),
    serializeSorted(selectedCategories),
    serializeSorted(selectedPriceRanges),
    nonHalalOnly ? 'non-halal' : 'all',
  ].join('::');
};

const readFilterCache = (key: string): Restaurant[] | null => {
  const entry = filterCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    filterCache.delete(key);
    return null;
  }

  return entry.value;
};

const writeFilterCache = (key: string, value: Restaurant[]): void => {
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
 * Enhanced restaurant filter that includes radius filtering
 * @param restaurants - Array of restaurants
 * @param userLocation - User's current location
 * @param selectedCategories - Selected food categories
 * @param radiusKm - Maximum distance in kilometers
 * @returns Filtered array of restaurants
 */
export const enhancedFilterRestaurants = (
  restaurants: Restaurant[],
  userLocation: { lat: number; lng: number } | null,
  selectedCategories: FoodCategory[],
  radiusKm: number,
  selectedPriceRanges: Restaurant['priceRange'][] = [],
  nonHalalOnly = false
): Restaurant[] => {
  const cacheKey = buildFilterCacheKey(
    userLocation,
    selectedCategories,
    radiusKm,
    selectedPriceRanges,
    nonHalalOnly
  );

  const cached = readFilterCache(cacheKey);
  if (cached) {
    return cached;
  }

  // First filter by categories
  let filtered = restaurants;
  
  if (selectedCategories.length > 0) {
    filtered = filtered.filter((restaurant) => 
      restaurant.category.some((category) => selectedCategories.includes(category as FoodCategory))
    );
  }

  if (selectedPriceRanges.length > 0) {
    filtered = filtered.filter((restaurant) => selectedPriceRanges.includes(restaurant.priceRange));
  }

  if (nonHalalOnly) {
    filtered = filtered.filter(isNonHalalRestaurant);
  }

  const withDistance = userLocation
    ? filtered.map((restaurant) => ({
        ...restaurant,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          restaurant.coordinates.lat,
          restaurant.coordinates.lng
        ),
      }))
    : filtered;

  // Then filter by radius
  const withinRadius = userLocation
    ? withDistance.filter((restaurant) => (restaurant.distance ?? 0) <= radiusKm)
    : filterByRadius(withDistance, userLocation, radiusKm);

  const result = !userLocation
    ? withinRadius
    : [...withinRadius].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  writeFilterCache(cacheKey, result);
  return result;
};
