import type { Restaurant } from '@/types';
import {
  GOOGLE_PLACE_FIELDS,
  getGoogleApiKey,
  normalizeGooglePlace,
  type GooglePlace,
} from '@/lib/googlePlacesRestaurants';
import { reservePlacesCall } from '@/lib/placesUsage';

const GOOGLE_TEXT_SEARCH_ENDPOINT =
  'https://places.googleapis.com/v1/places:searchText';

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
  error?: { message?: string; status?: string };
};

export interface TextSearchOptions {
  textQuery: string;
  location: { lat: number; lng: number };
  radiusKm?: number;
  language?: string;
  region?: string;
  maxResults?: number;
  signal?: AbortSignal;
}

/**
 * Search Google Places by free-text query (e.g. "chicken rice", "coffee").
 * Results are biased toward the user's current location.
 */
export async function searchPlacesByText(
  options: TextSearchOptions,
): Promise<Restaurant[]> {
  const apiKey = getGoogleApiKey();
  const radiusMeters = Math.round((options.radiusKm ?? 2) * 1000);
  const maxResultCount = Math.min(options.maxResults ?? 10, 20);

  // Count this billable call against the monthly budget (throws PlacesBudgetError when exhausted).
  await reservePlacesCall('text');

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
      openNow: true,
      languageCode: options.language ?? 'en',
      regionCode: options.region ?? 'SG',
      locationBias: {
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
  return places
    .map((place) => normalizeGooglePlace(place, options.location, apiKey))
    .filter((r): r is Restaurant => r !== null);
}
