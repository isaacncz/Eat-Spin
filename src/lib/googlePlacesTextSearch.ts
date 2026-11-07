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
import { filterMallRestaurants, MALL_DISCOVERY_RADIUS_KM, type MallIdentity } from '@/lib/mallSearch';

const GOOGLE_TEXT_SEARCH_ENDPOINT =
  'https://places.googleapis.com/v1/places:searchText';

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

export interface TextSearchOptions {
  mallPlaceId?: string;
  mallIdentity?: MallIdentity;
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

  const mall = options.mallIdentity?.placeId === options.mallPlaceId ? options.mallIdentity : undefined;
  const scoped = Boolean(mall);
  const request = {
    textQuery: mall ? `${options.textQuery} in ${mall.label}, ${mall.address}` : options.textQuery,
    ...(scoped ? { pageSize: 20 } : { maxResultCount }),
    rankPreference: scoped ? 'RELEVANCE' : 'DISTANCE',
    openNow: options.openNowOnly ?? true,
    languageCode: options.language ?? placesLanguage(),
    regionCode: options.region ?? placesRegion(),
    ...(rectangle ? { locationRestriction: { rectangle } } : { locationBias: {
      circle: {
        center: { latitude: options.location.lat, longitude: options.location.lng },
        radius: radiusMeters,
      },
    } }),
  };
  const found = new Map<string, Restaurant>();
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  // Google supports up to 60 Text Search results. Bound cost to three guarded calls.
  for (let page = 0; page < (scoped ? 3 : 1); page += 1) {
    options.signal?.throwIfAborted();
    await reservePlacesCall('text');
    options.signal?.throwIfAborted();
    const response = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': `${GOOGLE_PLACE_FIELDS}${scoped ? ',nextPageToken' : ''}`,
      },
      body: JSON.stringify({ ...request, ...(pageToken ? { pageToken } : {}) }),
      signal: options.signal,
    });
    const payload = await response.json().catch(() => null) as GoogleTextSearchResponse | null;
    options.signal?.throwIfAborted();
    if (!response.ok) throw new Error(payload?.error?.message?.trim() || `Google Text Search failed (${response.status})`);
    const normalized = (payload?.places ?? [])
      .map((place) => normalizeGooglePlace(place, options.location, apiKey))
      .filter((r): r is Restaurant => r !== null && (Boolean(options.mallPlaceId) || (r.distance ?? Infinity) <= radiusKm));
    for (const restaurant of filterMallRestaurants(normalized, options.mallPlaceId, mall)) {
      found.set(restaurant.googlePlaceId ?? restaurant.id, restaurant);
    }
    pageToken = payload?.nextPageToken;
    if (!pageToken || seenTokens.has(pageToken)) break;
    seenTokens.add(pageToken);
  }
  return [...found.values()];
}
