import type { DailyHours, FoodCategory, Restaurant } from '@/types';
import { calculateDistance } from '@/lib/restaurantUtils';

const GOOGLE_NEARBY_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_PLACE_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.nationalPhoneNumber',
  'places.regularOpeningHours.periods',
  'places.currentOpeningHours.openNow',
  'places.businessStatus',
].join(',');
const DEFAULT_MAX_RESULTS = 20;

type GooglePlaceOpeningPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

type GooglePlaceOpeningPeriod = {
  open?: GooglePlaceOpeningPoint;
  close?: GooglePlaceOpeningPoint;
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  regularOpeningHours?: { periods?: GooglePlaceOpeningPeriod[] };
  currentOpeningHours?: { openNow?: boolean };
  businessStatus?: string;
};

type GoogleNearbyResponse = {
  places?: GooglePlace[];
  error?: {
    message?: string;
    status?: string;
  };
};

export interface FetchNearbyGoogleRestaurantsOptions {
  location: { lat: number; lng: number };
  radiusKm: number;
  region: string;
  language: string;
  signal?: AbortSignal;
  maxResults?: number;
}

const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const mapGooglePriceLevel = (priceLevel?: string): {
  priceRange: Restaurant['priceRange'];
  hasKnownPriceRange: boolean;
} => {
  switch (priceLevel) {
    case 'PRICE_LEVEL_FREE':
    case 'PRICE_LEVEL_INEXPENSIVE':
      return { priceRange: '$', hasKnownPriceRange: true };
    case 'PRICE_LEVEL_MODERATE':
      return { priceRange: '$$', hasKnownPriceRange: true };
    case 'PRICE_LEVEL_EXPENSIVE':
      return { priceRange: '$$$', hasKnownPriceRange: true };
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return { priceRange: '$$$$', hasKnownPriceRange: true };
    default:
      // Keep UI-compatible default while marking unknown price confidence.
      return { priceRange: '$$', hasKnownPriceRange: false };
  }
};

const formatTime = (hour?: number, minute?: number): string => {
  const safeHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour ?? 0))) : 0;
  const safeMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.floor(minute ?? 0))) : 0;
  return `${safeHour.toString().padStart(2, '0')}:${safeMinute.toString().padStart(2, '0')}`;
};

const buildDefaultHours = (): Record<string, DailyHours> => ({
  daily: { windows: [{ open: '00:00', close: '23:59' }] },
});

const mapOpeningHours = (periods: GooglePlaceOpeningPeriod[] | undefined): Record<string, DailyHours> => {
  if (!periods || periods.length === 0) {
    return buildDefaultHours();
  }

  const windowsByDay: Record<string, { open: string; close: string }[]> = Object.fromEntries(
    dayKeys.map((dayKey) => [dayKey, [] as { open: string; close: string }[]])
  );

  for (const period of periods) {
    const open = period.open;
    if (!open || typeof open.day !== 'number') continue;

    const dayKey = dayKeys[((open.day % 7) + 7) % 7];
    const openTime = formatTime(open.hour, open.minute);
    const closeTime = period.close
      ? formatTime(period.close.hour, period.close.minute)
      : '23:59';
    windowsByDay[dayKey].push({ open: openTime, close: closeTime });
  }

  const mappedHours: Record<string, DailyHours> = {};
  for (const dayKey of dayKeys) {
    const windows = windowsByDay[dayKey];
    mappedHours[dayKey] = windows.length > 0
      ? { windows }
      : { closed: true, windows: [] };
  }

  return mappedHours;
};

const googleTypeToCategory = new Map<string, FoodCategory>([
  ['japanese_restaurant', 'japanese'],
  ['korean_restaurant', 'korean'],
  ['chinese_restaurant', 'chinese'],
  ['indian_restaurant', 'indian'],
  ['thai_restaurant', 'thai'],
  ['seafood_restaurant', 'seafood'],
  ['chicken_restaurant', 'chicken'],
  ['steak_house', 'beef'],
  ['vegetarian_restaurant', 'vegetarian'],
  ['cafe', 'cafe'],
  ['bakery', 'bakery'],
  ['dessert_restaurant', 'dessert'],
  ['dessert_shop', 'dessert'],
  ['ice_cream_shop', 'dessert'],
  ['breakfast_restaurant', 'breakfast'],
]);

const mapGoogleTypesToCategories = (types: string[] | undefined): FoodCategory[] => {
  if (!types || types.length === 0) return ['western'];

  const categories: FoodCategory[] = [];
  for (const type of types) {
    const mapped = googleTypeToCategory.get(type);
    if (!mapped || categories.includes(mapped)) continue;
    categories.push(mapped);
  }

  if (categories.length > 0) return categories;
  return ['western'];
};

const getGoogleApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY is missing');
  }
  return apiKey.trim();
};

const normalizeGooglePlace = (
  place: GooglePlace,
  location: { lat: number; lng: number }
): Restaurant | null => {
  if (!place.id) return null;
  if (!place.location || typeof place.location.latitude !== 'number' || typeof place.location.longitude !== 'number') {
    return null;
  }
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
    return null;
  }

  const coordinates = {
    lat: place.location.latitude,
    lng: place.location.longitude,
  };
  const distance = calculateDistance(location.lat, location.lng, coordinates.lat, coordinates.lng);
  const categories = mapGoogleTypesToCategories(place.types);
  const rating = typeof place.rating === 'number' ? Number(place.rating.toFixed(1)) : 0;
  const userRatingCount = typeof place.userRatingCount === 'number' ? place.userRatingCount : 0;
  const mappedPrice = mapGooglePriceLevel(place.priceLevel);

  return {
    id: `gplace-${place.id}`,
    googlePlaceId: place.id,
    source: 'google-live',
    name: place.displayName?.text?.trim() || 'Nearby Restaurant',
    category: categories,
    address: place.formattedAddress?.trim() || 'Nearby area',
    coordinates,
    hours: mapOpeningHours(place.regularOpeningHours?.periods),
    rating,
    userRatingCount,
    priceRange: mappedPrice.priceRange,
    hasKnownPriceRange: mappedPrice.hasKnownPriceRange,
    phone: place.nationalPhoneNumber?.trim(),
    description: 'Highly rated nearby pick from Google Maps.',
    isOpen: place.currentOpeningHours?.openNow ?? true,
    distance,
  };
};

const toFriendlyApiError = (response: Response, payload: GoogleNearbyResponse | null): string => {
  const apiMessage = payload?.error?.message?.trim();
  if (apiMessage) {
    return `Google Places error (${response.status}): ${apiMessage}`;
  }

  return `Google Places request failed (${response.status})`;
};

export const fetchNearbyGoogleRestaurants = async (
  options: FetchNearbyGoogleRestaurantsOptions
): Promise<Restaurant[]> => {
  const apiKey = getGoogleApiKey();
  const maxResultCount = Math.max(1, Math.min(options.maxResults ?? DEFAULT_MAX_RESULTS, 20));
  const radiusMeters = Math.max(1, Math.min(Math.round(options.radiusKm * 1000), 50_000));

  const response = await fetch(GOOGLE_NEARBY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_PLACE_FIELDS,
    },
    body: JSON.stringify({
      includedTypes: ['restaurant'],
      maxResultCount,
      rankPreference: 'DISTANCE',
      openNow: true,
      languageCode: options.language,
      regionCode: options.region,
      locationRestriction: {
        circle: {
          center: {
            latitude: options.location.lat,
            longitude: options.location.lng,
          },
          radius: radiusMeters,
        },
      },
    }),
    signal: options.signal,
  });

  const payload = (await response.json().catch(() => null)) as GoogleNearbyResponse | null;
  if (!response.ok) {
    throw new Error(toFriendlyApiError(response, payload));
  }

  const places = payload?.places ?? [];
  return places
    .map((place) => normalizeGooglePlace(place, options.location))
    .filter((restaurant): restaurant is Restaurant => Boolean(restaurant));
};

export const rankNearbyRestaurants = (
  restaurants: Restaurant[],
  location: { lat: number; lng: number },
  radiusKm: number,
  limit: number = 12,
  source?: Restaurant['source']
): Restaurant[] => {
  const filtered = restaurants
    .map((restaurant) => {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        restaurant.coordinates.lat,
        restaurant.coordinates.lng
      );

      return {
        ...restaurant,
        distance,
      };
    })
    .filter((restaurant) => (restaurant.distance ?? Number.POSITIVE_INFINITY) <= radiusKm);

  const sorted = [...filtered].sort((left, right) => {
    if (right.rating !== left.rating) return right.rating - left.rating;

    const ratingCountDelta = (right.userRatingCount ?? 0) - (left.userRatingCount ?? 0);
    if (ratingCountDelta !== 0) return ratingCountDelta;

    return (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY);
  });

  const limited = sorted.slice(0, Math.max(1, limit));
  if (!source) return limited;

  return limited.map((restaurant) => ({
    ...restaurant,
    source,
  }));
};
