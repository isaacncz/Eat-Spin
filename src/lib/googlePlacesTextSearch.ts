import { radiusRectangle } from '@/lib/searchDestination';
import { placesRegion, placesLanguage } from '@/lib/googlePlacesDestinations';
import type { Restaurant } from '@/types';
import {
  GOOGLE_PLACE_FIELDS,
  getGoogleApiKey,
  normalizeGooglePlace,
  type GooglePlace,
} from '@/lib/googlePlacesRestaurants';
import { reservePlacesCall } from '@/lib/placesUsage';
import { filterMallRestaurants, MALL_DISCOVERY_RADIUS_KM } from '@/lib/mallSearch';

const GOOGLE_TEXT_SEARCH_ENDPOINT =
  'https://places.googleapis.com/v1/places:searchText';

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
  error?: { message?: string; status?: string };
};

export interface TextSearchOptions {
  mallPlaceId?: string;
  textQuery: string;
  location: { lat: number; lng: number };
  radiusKm?: number;
  language?: string;
  region?: string;
  maxResults?: number;
  signal?: AbortSignal;
  openNowOnly?: boolean;
  restrictToRectangle?: boolean;
}

/**
 * Search Google Places by free-text query (e.g. "chicken rice", "coffee").
 * Results are biased toward the user's current location.
 */
export async function searchPlacesByText(
  options: TextSearchOptions,
): Promise<Restaurant[]> {
  const apiKey = getGoogleApiKey();
  const radiusKm = options.mallPlaceId ? MALL_DISCOVERY_RADIUS_KM : options.radiusKm ?? 2;
  const radiusMeters = Math.round(radiusKm * 1000);
  const rectangle = options.restrictToRectangle === false ? null : radiusRectangle(options.location, radiusKm);
  const maxResultCount = Math.min(options.maxResults ?? 10, 20);

  // Count this billable call against the monthly budget (throws PlacesBudgetError when exhausted).
  await reservePlacesCall('text');

  options.signal?.throwIfAborted();
  const response = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': GOOGLE_PLACE_FIELDS,
    },
    body: JSON.stringify({
      textQuery: options.textQuery,
      maxResultCount,
      rankPreference: 'DISTANCE',
      openNow: options.openNowOnly ?? true,
      languageCode: options.language ?? placesLanguage(),
      regionCode: options.region ?? placesRegion(),
      ...(rectangle ? { locationRestriction: { rectangle } } : { locationBias: {
        circle: {
          center: {
            latitude: options.location.lat,
            longitude: options.location.lng,
          },
          radius: radiusMeters,
        },
      } }),
    }),
    signal: options.signal,
  });

  const payload = (await response.json().catch(
    () => null,
  )) as GoogleTextSearchResponse | null;

  if (!response.ok) {
    const msg =
      payload?.error?.message?.trim() ||
      `Google Text Search failed (${response.status})`;
    throw new Error(msg);
  }

  const places = payload?.places ?? [];
  return filterMallRestaurants(places
    .map((place) => normalizeGooglePlace(place, options.location, apiKey))
    .filter((r): r is Restaurant => r !== null && (Boolean(options.mallPlaceId) || (r.distance ?? Infinity) <= radiusKm)), options.mallPlaceId);
}
