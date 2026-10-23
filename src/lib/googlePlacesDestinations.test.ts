import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/placesUsage', () => ({ reservePlacesCall: vi.fn().mockResolvedValue(undefined) }));
import { reservePlacesCall } from '@/lib/placesUsage';
import { autocompleteDestinations, resolveDestination } from './googlePlacesDestinations';
import { searchPlacesByText } from './googlePlacesTextSearch';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test'); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('uses the same session for autocomplete and Essentials Details, taking the label from the suggestion', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ suggestions: [{ placePrediction: { placeId: 'kiara', structuredFormat: { mainText: { text: 'Mont Kiara' }, secondaryText: { text: 'Kuala Lumpur' } } } }] }));
  const signal = new AbortController().signal;
  const suggestions = await autocompleteDestinations('Mont', 'session-one', signal);
  const autocomplete = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(autocomplete.sessionToken).toBe('session-one');
  expect(autocomplete.includedPrimaryTypes).toBeUndefined();
  fetchMock.mockResolvedValueOnce(Response.json({ location: { latitude: 3.17, longitude: 101.65 }, formattedAddress: 'Kuala Lumpur, Malaysia' }));
  const result = await resolveDestination(suggestions[0], 'session-one', signal);
  expect(fetchMock.mock.calls[1][0]).toContain('sessionToken=session-one');
  expect(fetchMock.mock.calls[1][1].headers['X-Goog-FieldMask']).toBe('location,formattedAddress');
  expect(result.label).toBe('Mont Kiara');
  expect(reservePlacesCall).toHaveBeenCalledWith('autocomplete');
  expect(reservePlacesCall).toHaveBeenCalledWith('details');
});
it('enforces exact radius even for rectangle corner results and never sends both location parameters', async () => {
  const place = (id: string, lat: number, lng: number) => ({ id, displayName: { text: id }, location: { latitude: lat, longitude: lng }, types: ['restaurant'] });
  fetchMock.mockResolvedValueOnce(Response.json({ places: [place('inside', 0, 0.01), place('corner', 0.025, 0.025)] }));
  const results = await searchPlacesByText({ textQuery: 'food', location: { lat: 0, lng: 0 }, radiusKm: 3, openNowOnly: false });
  expect(results.map((r) => r.name)).toEqual(['inside']);
  const request = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(request.locationRestriction.rectangle).toBeDefined();
  expect(request.locationBias).toBeUndefined();
  expect(request.openNow).toBe(false);
  fetchMock.mockResolvedValueOnce(Response.json({ places: [] }));
  await searchPlacesByText({ textQuery: 'food', location: { lat: 0, lng: 179.999 }, radiusKm: 3 });
  const fallback = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(fallback.locationRestriction).toBeUndefined();
  expect(fallback.locationBias.circle.radius).toBe(3000);
});
