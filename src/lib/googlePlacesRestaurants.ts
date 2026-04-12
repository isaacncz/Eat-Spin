import type { CategoryConfidence, DailyHours, FoodCategory, Restaurant } from '@/types';
import { calculateDistance } from '@/lib/restaurantUtils';
import { computeQualityScore } from '@/lib/restaurantUtils';
import { classifyPlace } from '@/lib/categoryClassifier';

const GOOGLE_NEARBY_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';
export const GOOGLE_PLACE_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
  'places.primaryType',
  'places.editorialSummary',
  'places.photos.name',
  'places.nationalPhoneNumber',
  'places.regularOpeningHours.periods',
  'places.currentOpeningHours.openNow',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.delivery',
  'places.takeout',
  'places.dineIn',
  'places.servesCoffee',
  'places.servesBreakfast',
  'places.servesBrunch',
  'places.servesLunch',
  'places.servesDinner',
  'places.servesDessert',
  'places.servesVegetarianFood',
  'places.goodForGroups',
  'places.goodForChildren',
  'places.outdoorSeating',
  'places.generativeSummary',
].join(',');
const DEFAULT_MAX_RESULTS = 20;

// ---------------------------------------------------------------------------
// Excluded types – sent to the Google API to prevent non-restaurant results
// ---------------------------------------------------------------------------
const EXCLUDED_TYPES: string[] = [
  'gas_station',
  'convenience_store',
  'supermarket',
  'grocery_store',
  'department_store',
  'shopping_mall',
  'hotel',
  'lodging',
  'hospital',
  'pharmacy',
  'store',
  'car_wash',
  'car_repair',
  'parking',
  'auto_parts_store',
  'movie_theater',
  'tourist_attraction',
];

// ---------------------------------------------------------------------------
// Primary-type blacklist – if Google's single best-guess type is one of these
// the place is not a real restaurant even though it may serve food.
// ---------------------------------------------------------------------------
const BLACKLISTED_PRIMARY_TYPES: ReadonlySet<string> = new Set([
  'gas_station',
  'convenience_store',
  'supermarket',
  'grocery_store',
  'department_store',
  'shopping_mall',
  'hotel',
  'lodging',
  'hospital',
  'pharmacy',
  'store',
  'car_wash',
  'car_repair',
  'parking',
  'auto_parts_store',
  'movie_theater',
  'tourist_attraction',
  'event_venue',
  'night_club',
  'bar',
  'liquor_store',
  'amusement_park',
  'bowling_alley',
  'gym',
  'spa',
  'beauty_salon',
  'laundry',
  'school',
  'university',
  'library',
  'church',
  'mosque',
  'temple',
]);

type GooglePlaceOpeningPoint = {
  day?: number;
  hour?: number;
  minute?: number;
};

type GooglePlaceOpeningPeriod = {
  open?: GooglePlaceOpeningPoint;
  close?: GooglePlaceOpeningPoint;
};

type GooglePlacePhoto = {
  name?: string;
};

export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  /** Google's single best-guess type for the place — more reliable than the full types array. */
  primaryType?: string;
  /** Free-text editorial description authored by Google. */
  editorialSummary?: { text?: string };
  photos?: GooglePlacePhoto[];
  nationalPhoneNumber?: string;
  regularOpeningHours?: { periods?: GooglePlaceOpeningPeriod[] };
  currentOpeningHours?: { openNow?: boolean };
  businessStatus?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  delivery?: boolean;
  takeout?: boolean;
  dineIn?: boolean;
  servesCoffee?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesDessert?: boolean;
  servesVegetarianFood?: boolean;
  goodForGroups?: boolean;
  goodForChildren?: boolean;
  outdoorSeating?: boolean;
  generativeSummary?: { overview?: { text?: string } };
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
  /** When set, the API request uses cuisine-specific Google types instead of generic 'restaurant'. */
  selectedCategories?: FoodCategory[];
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
  ['sushi_restaurant', 'japanese'],
  ['ramen_restaurant', 'japanese'],
  ['korean_restaurant', 'korean'],
  ['chinese_restaurant', 'chinese'],
  ['indian_restaurant', 'indian'],
  ['thai_restaurant', 'thai'],
  ['malaysian_restaurant', 'malay'],
  ['seafood_restaurant', 'seafood'],
  ['chicken_restaurant', 'chicken'],
  ['steak_house', 'beef'],
  ['barbecue_restaurant', 'bbq'],
  ['vegetarian_restaurant', 'vegetarian'],
  ['vegan_restaurant', 'vegetarian'],
  ['cafe', 'cafe'],
  ['coffee_shop', 'cafe'],
  ['bakery', 'bakery'],
  ['dessert_restaurant', 'dessert'],
  ['dessert_shop', 'dessert'],
  ['ice_cream_shop', 'dessert'],
  ['breakfast_restaurant', 'breakfast'],
  ['brunch_restaurant', 'brunch'],
  ['american_restaurant', 'western'],
  ['italian_restaurant', 'western'],
  ['french_restaurant', 'western'],
  ['hamburger_restaurant', 'western'],
  ['pizza_restaurant', 'pizza'],
  ['sandwich_shop', 'western'],
  ['mediterranean_restaurant', 'western'],
  ['mexican_restaurant', 'western'],
  ['spanish_restaurant', 'western'],
  ['fast_food_restaurant', 'fast-food'],
]);

// ---------------------------------------------------------------------------
// Category → Google Place types mapping (cuisine-specific fetching)
// ---------------------------------------------------------------------------

/**
 * Maps each app FoodCategory to the Google Places API (New) `includedTypes`
 * that should be used when the user selects that cuisine.
 *
 * Categories with no direct Google type equivalent (soup, rice, noodles,
 * street food) fall back to the generic 'restaurant' type — the heuristic
 * classifier in categoryClassifier.ts handles sub-filtering.
 */
const CATEGORY_TO_GOOGLE_TYPES: Partial<Record<FoodCategory, string[]>> = {
  chinese:      ['chinese_restaurant'],
  indian:       ['indian_restaurant'],
  japanese:     ['japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant'],
  korean:       ['korean_restaurant'],
  thai:         ['thai_restaurant'],
  malay:        ['malaysian_restaurant'],
  western:      ['american_restaurant', 'italian_restaurant', 'french_restaurant',
                 'hamburger_restaurant', 'steak_house',
                 'sandwich_shop', 'mediterranean_restaurant', 'mexican_restaurant',
                 'spanish_restaurant'],
  cafe:         ['cafe', 'coffee_shop'],
  bakery:       ['bakery'],
  dessert:      ['dessert_restaurant', 'ice_cream_shop', 'bakery'],
  seafood:      ['seafood_restaurant'],
  chicken:      ['chicken_restaurant'],
  beef:         ['steak_house'],
  vegetarian:   ['vegetarian_restaurant', 'vegan_restaurant'],
  breakfast:    ['breakfast_restaurant'],
  brunch:       ['brunch_restaurant', 'breakfast_restaurant'],
  pizza:        ['pizza_restaurant'],
  'fast-food':  ['fast_food_restaurant'],
  bbq:          ['barbecue_restaurant'],
  hotpot:       ['chinese_restaurant'],
  'bubble-tea': ['cafe'],
};

/**
 * Build the `includedTypes` array for a Google Nearby Search request.
 *
 * - No categories selected → `['restaurant']` (inherits all cuisine subtypes,
 *   excludes cafe / bakery / ice cream)
 * - Categories selected → union of all Google types from the mapping,
 *   deduplicated. Falls back to `['restaurant']` if none of the selected
 *   categories have a Google type (dish-type-only selection).
 */
const buildIncludedTypes = (selectedCategories?: FoodCategory[]): string[] => {
  if (!selectedCategories || selectedCategories.length === 0) {
    return ['restaurant'];
  }

  const typesSet = new Set<string>();
  for (const category of selectedCategories) {
    const googleTypes = CATEGORY_TO_GOOGLE_TYPES[category];
    if (googleTypes) {
      for (const type of googleTypes) {
        typesSet.add(type);
      }
    }
  }

  // Dish-type-only categories (soup, rice, etc.) have no Google types.
  // Fall back to generic restaurant and let the heuristic post-filter handle it.
  if (typesSet.size === 0) {
    return ['restaurant'];
  }

  return [...typesSet];
};

const mapGoogleTypesToCategories = (types: string[] | undefined): FoodCategory[] => {
  if (!types || types.length === 0) return [];

  const categories: FoodCategory[] = [];
  for (const type of types) {
    const mapped = googleTypeToCategory.get(type);
    if (!mapped || categories.includes(mapped)) continue;
    categories.push(mapped);
  }

  return categories;
};

export const getGoogleApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY is missing');
  }
  return apiKey.trim();
};

/**
 * Cuisine-type categories (as opposed to dish-type categories like 'soup', 'noodles').
 * Used during confidence scoring to distinguish meaningful cuisine classification
 * from dish-level tags that don't indicate a restaurant's primary identity.
 */
const CUISINE_CATEGORIES: ReadonlySet<FoodCategory> = new Set([
  'western', 'chinese', 'malay', 'indian', 'thai', 'japanese', 'korean',
  'cafe', 'bakery', 'dessert', 'seafood', 'vegetarian', 'breakfast',
  'chicken', 'beef', 'bubble-tea', 'pizza', 'fast-food', 'hotpot', 'bbq', 'brunch',
]);

/**
 * Compute how confident we are about a restaurant's category classification.
 *
 * Tiers:
 * - `high`: primaryType directly maps to a cuisine, or the type mapper found
 *   a cuisine AND the heuristic independently corroborates it
 * - `medium`: at least one signal found a cuisine category
 * - `low`: no cuisine signal at all (only dish-type tags or completely empty)
 */
const computeCategoryConfidence = (
  primaryTypeCategory: FoodCategory | undefined,
  typeMapperCategories: FoodCategory[],
  heuristicCategories: FoodCategory[],
): CategoryConfidence => {
  // primaryType is Google's single best-guess — highest trust
  if (primaryTypeCategory && CUISINE_CATEGORIES.has(primaryTypeCategory)) {
    return 'high';
  }

  const typeMapperCuisines = typeMapperCategories.filter((c) => CUISINE_CATEGORIES.has(c));
  const heuristicCuisines = heuristicCategories.filter((c) => CUISINE_CATEGORIES.has(c));

  // Both independent signals agree on at least one cuisine
  if (typeMapperCuisines.length > 0 && heuristicCuisines.length > 0) {
    const overlapExists = typeMapperCuisines.some((c) => heuristicCuisines.includes(c));
    if (overlapExists) return 'high';
    // Different cuisines from different signals — still two signals
    return 'medium';
  }

  // At least one signal found a cuisine
  if (typeMapperCuisines.length > 0 || heuristicCuisines.length > 0) {
    return 'medium';
  }

  return 'low';
};

export const normalizeGooglePlace = (
  place: GooglePlace,
  location: { lat: number; lng: number },
  apiKey: string,
): Restaurant | null => {
  if (!place.id) return null;
  if (!place.location || typeof place.location.latitude !== 'number' || typeof place.location.longitude !== 'number') {
    return null;
  }
  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
    return null;
  }

  // Reject places whose primary identity is not a food establishment.
  if (place.primaryType && BLACKLISTED_PRIMARY_TYPES.has(place.primaryType)) {
    return null;
  }

  const coordinates = {
    lat: place.location.latitude,
    lng: place.location.longitude,
  };
  const distance = calculateDistance(location.lat, location.lng, coordinates.lat, coordinates.lng);

  // --- Category classification with multi-signal confidence ---

  // Signal 1: primaryType (Google's single best-guess type)
  const primaryTypeCategory = place.primaryType
    ? googleTypeToCategory.get(place.primaryType)
    : undefined;

  // Signal 2: full types[] array mapping
  const typeMapperCategories = mapGoogleTypesToCategories(place.types);

  // Signal 3: name + editorial summary heuristic
  const heuristicCategories = classifyPlace({
    displayName: place.displayName?.text,
    types: place.types,
    editorialSummary: place.editorialSummary?.text,
  });

  // Merge all signals: primaryType first (highest trust), then type mapper, then heuristic
  const allCategories: FoodCategory[] = [];
  const seen = new Set<FoodCategory>();

  if (primaryTypeCategory && !seen.has(primaryTypeCategory)) {
    allCategories.push(primaryTypeCategory);
    seen.add(primaryTypeCategory);
  }
  for (const cat of typeMapperCategories) {
    if (!seen.has(cat)) { allCategories.push(cat); seen.add(cat); }
  }
  for (const cat of heuristicCategories) {
    if (!seen.has(cat)) { allCategories.push(cat); seen.add(cat); }
  }

  // No fallback to 'western' — empty categories + low confidence is honest
  const categories = allCategories;
  const categoryConfidence = computeCategoryConfidence(
    primaryTypeCategory,
    typeMapperCategories,
    heuristicCategories,
  );

  const rating = typeof place.rating === 'number' ? Number(place.rating.toFixed(1)) : 0;
  const userRatingCount = typeof place.userRatingCount === 'number' ? place.userRatingCount : 0;
  const mappedPrice = mapGooglePriceLevel(place.priceLevel);
  const photoName = place.photos?.[0]?.name?.trim();
  const image = photoName
    ? `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=720&maxWidthPx=720&key=${apiKey}`
    : undefined;

  return {
    id: `gplace-${place.id}`,
    googlePlaceId: place.id,
    source: 'google-live',
    name: place.displayName?.text?.trim() || 'Nearby Restaurant',
    category: categories,
    categoryConfidence,
    address: place.formattedAddress?.trim() || 'Nearby area',
    coordinates,
    hours: mapOpeningHours(place.regularOpeningHours?.periods),
    rating,
    userRatingCount,
    priceRange: mappedPrice.priceRange,
    hasKnownPriceRange: mappedPrice.hasKnownPriceRange,
    phone: place.nationalPhoneNumber?.trim(),
    image,
    description: place.editorialSummary?.text?.trim() || 'Highly rated nearby pick from Google Maps.',
    isOpen: place.currentOpeningHours?.openNow ?? true,
    distance,
    googleMapsUri: place.googleMapsUri?.trim(),
    websiteUri: place.websiteUri?.trim(),
    delivery: place.delivery,
    takeout: place.takeout,
    dineIn: place.dineIn,
    servesCoffee: place.servesCoffee,
    servesBreakfast: place.servesBreakfast,
    servesBrunch: place.servesBrunch,
    servesLunch: place.servesLunch,
    servesDinner: place.servesDinner,
    servesDessert: place.servesDessert,
    servesVegetarianFood: place.servesVegetarianFood,
    goodForGroups: place.goodForGroups,
    goodForChildren: place.goodForChildren,
    outdoorSeating: place.outdoorSeating,
    generativeSummary: place.generativeSummary?.overview?.text?.trim(),
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
  const includedTypes = buildIncludedTypes(options.selectedCategories);

  const response = await fetch(GOOGLE_NEARBY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_PLACE_FIELDS,
    },
    body: JSON.stringify({
      includedTypes,
      excludedTypes: EXCLUDED_TYPES,
      maxResultCount,
      rankPreference: 'POPULARITY',
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
  const restaurants = places
    .map((place) => normalizeGooglePlace(place, options.location, apiKey))
    .filter((restaurant): restaurant is Restaurant => Boolean(restaurant));

  // When the API was called with cuisine-specific types, force-tag each result
  // with the corresponding app categories and boost confidence to 'high'
  // since Google already pre-filtered by cuisine type.
  if (options.selectedCategories && options.selectedCategories.length > 0) {
    return restaurants.map((restaurant) => {
      const existing = new Set(restaurant.category);
      const enriched = [...restaurant.category];
      for (const cat of options.selectedCategories!) {
        if (!existing.has(cat)) {
          enriched.push(cat);
          existing.add(cat);
        }
      }
      return {
        ...restaurant,
        category: enriched.length !== restaurant.category.length ? enriched : restaurant.category,
        categoryConfidence: 'high' as CategoryConfidence,
      };
    });
  }

  return restaurants;
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
    // Primary sort: weighted quality score (rating × review volume)
    const leftScore = computeQualityScore(left.rating, left.userRatingCount ?? 0);
    const rightScore = computeQualityScore(right.rating, right.userRatingCount ?? 0);
    if (Math.abs(rightScore - leftScore) > 0.01) return rightScore - leftScore;

    // Tiebreaker: distance (closer is better)
    return (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY);
  });

  const limited = sorted.slice(0, Math.max(1, limit));
  if (!source) return limited;

  return limited.map((restaurant) => ({
    ...restaurant,
    source,
  }));
};
