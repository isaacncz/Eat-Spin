import { getGoogleApiKey } from '@/lib/googlePlacesRestaurants';
import { reservePlacesCall } from '@/lib/placesUsage';
import { validCoordinates, type SearchDestination } from '@/lib/searchDestination';

export interface DestinationSuggestion { placeId: string; label: string; address: string }
export const placesRegion = () => (import.meta.env.VITE_GOOGLE_PLACES_REGION as string | undefined)?.trim().toUpperCase() || 'MY';
export const placesLanguage = () => (import.meta.env.VITE_GOOGLE_PLACES_LANGUAGE as string | undefined)?.trim() || 'en';

async function payload(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Destination lookup failed (${response.status})`);
  return data;
}
export async function autocompleteDestinations(input: string, sessionToken: string, signal: AbortSignal): Promise<DestinationSuggestion[]> {
  const key = getGoogleApiKey();
  // Conservatively reserve every request: abandoned sessions bill every request.
  await reservePlacesCall('autocomplete');
  signal.throwIfAborted();
  const data = await payload(await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text' },
    body: JSON.stringify({ input, sessionToken, languageCode: placesLanguage(), regionCode: placesRegion() }),
  }));
  return (data?.suggestions ?? []).flatMap((s: { placePrediction?: { placeId?: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }) => {
    const p = s.placePrediction;
    const label = p?.structuredFormat?.mainText?.text || p?.text?.text;
    return p?.placeId && label ? [{ placeId: p.placeId, label, address: p.structuredFormat?.secondaryText?.text || '' }] : [];
  });
}
export async function resolveDestination(suggestion: DestinationSuggestion, sessionToken: string, signal: AbortSignal): Promise<SearchDestination> {
  const key = getGoogleApiKey();
  await reservePlacesCall('details');
  signal.throwIfAborted();
  const query = new URLSearchParams({ sessionToken, languageCode: placesLanguage(), regionCode: placesRegion() });
  const data = await payload(await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.placeId)}?${query}`, {
    signal, headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location,formattedAddress' },
  }));
  const coordinates = { lat: data?.location?.latitude, lng: data?.location?.longitude };
  if (!validCoordinates(coordinates)) throw new Error('This place has no usable location. Choose another destination.');
  return { placeId: suggestion.placeId, label: suggestion.label, address: data.formattedAddress || suggestion.address,
    coordinates, fetchedAt: Date.now() };
}
