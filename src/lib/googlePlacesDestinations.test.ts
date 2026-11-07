import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/placesUsage', () => ({ reservePlacesCall: vi.fn().mockResolvedValue(undefined) }));
import { reservePlacesCall } from '@/lib/placesUsage';
import { autocompleteDestinations, resolveDestination, refreshMallDestination } from './googlePlacesDestinations';
import { searchPlacesByText } from './googlePlacesTextSearch';
import { fetchNearbyGoogleRestaurants } from './googlePlacesRestaurants';

const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test'); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('uses the same session for autocomplete and type-aware Details, taking the label from the suggestion', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ suggestions: [{ placePrediction: { placeId: 'kiara', structuredFormat: { mainText: { text: 'Mont Kiara' }, secondaryText: { text: 'Kuala Lumpur' } } } }] }));
  const signal = new AbortController().signal;
  const suggestions = await autocompleteDestinations('Mont', 'session-one', signal);
  const autocomplete = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(autocomplete.sessionToken).toBe('session-one');
  expect(autocomplete.includedPrimaryTypes).toBeUndefined();
  fetchMock.mockResolvedValueOnce(Response.json({ location: { latitude: 3.17, longitude: 101.65 }, formattedAddress: 'Kuala Lumpur, Malaysia' }));
  const result = await resolveDestination(suggestions[0], 'session-one', signal);
  expect(fetchMock.mock.calls[1][0]).toContain('sessionToken=session-one');
  expect(fetchMock.mock.calls[1][1].headers['X-Goog-FieldMask']).toBe('location,formattedAddress,types');
  expect(result.label).toBe('Mont Kiara');
  expect(reservePlacesCall).toHaveBeenCalledWith('autocomplete');
  expect(reservePlacesCall).toHaveBeenCalledWith('details');
});
it('defaults a provider-confirmed shopping mall to inside-only, not a mall-like name', async () => {
  const suggestion = { placeId: 'pyramid', label: 'Sunway Pyramid', address: 'Malaysia' };
  fetchMock.mockResolvedValueOnce(Response.json({ location: { latitude: 3.07, longitude: 101.6 }, types: ['shopping_mall'] }));
  expect(await resolveDestination(suggestion, 'session', new AbortController().signal)).toMatchObject({ mallPlaceId: 'pyramid', scope: 'inside' });
  fetchMock.mockResolvedValueOnce(Response.json({ location: { latitude: 3.07, longitude: 101.6 }, types: ['locality'] }));
  expect((await resolveDestination(suggestion, 'session2', new AbortController().signal)).mallPlaceId).toBeUndefined();
});
it('applies the same strict membership check to Nearby and Text Search', async () => {
  const place = (id: string, parent?: string) => ({ id, displayName: { text: id }, types: ['restaurant'],
    location: { latitude: 3.07, longitude: 101.6 }, ...(parent ? { containingPlaces: [{ id: parent }] } : {}) });
  const places = [place('tenant', 'pyramid'), place('outside', 'other'), place('unknown')];
  fetchMock.mockResolvedValueOnce(Response.json({ places }));
  const nearby = await fetchNearbyGoogleRestaurants({ location: { lat: 3.07, lng: 101.6 }, radiusKm: 2, region: 'MY', language: 'en', mallPlaceId: 'pyramid' });
  expect(nearby.map((r) => r.name)).toEqual(['tenant']);
  expect(nearby[0].containingPlaceIds).toEqual(['pyramid']);
  fetchMock.mockResolvedValueOnce(Response.json({ places }));
  const text = await searchPlacesByText({ textQuery: 'food', location: { lat: 3.07, lng: 101.6 }, radiusKm: 10, mallPlaceId: 'pyramid' });
  expect(text.map((r) => r.name)).toEqual(['tenant']);
  expect(fetchMock.mock.calls[1][1].headers['X-Goog-FieldMask']).toContain('places.containingPlaces');
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

const mallIdentity = { placeId: 'pyramid', label: 'Sunway Pyramid', address: '3, Jalan PJS 11/15, 47500 Petaling Jaya' };
const mallOptions = { location: { lat: 3.07, lng: 101.6 }, radiusKm: 2, region: 'MY', language: 'en', mallPlaceId: 'pyramid', mallIdentity };
const tenantPlace = (id: string, address = 'LG1.110, Sunway Pyramid', parent?: string) => ({
  id, displayName: { text: id }, formattedAddress: address, types: ['restaurant'],
  location: { latitude: 3.07, longitude: 101.6 }, ...(parent ? { containingPlaces: [{ id: parent }] } : {}),
});

it('discovers mall tenants through scoped text pages, deduplicates and rejects outside addresses before returning', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('first'), tenantPlace('hotel', 'Unit 1, Sunway Pyramid Hotel')], nextPageToken: 'second' }));
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('first'), tenantPlace('second'), tenantPlace('conflict', undefined, 'other')], nextPageToken: 'third' }));
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('third')], nextPageToken: 'fourth' }));
  const restaurants = await fetchNearbyGoogleRestaurants(mallOptions);
  expect(restaurants.map((r) => r.name)).toEqual(['first', 'second', 'third']);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(reservePlacesCall).toHaveBeenCalledTimes(3);
  expect(reservePlacesCall).toHaveBeenCalledWith('text');
  const requests = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body));
  expect(requests[0]).toMatchObject({ textQuery: 'restaurants in Sunway Pyramid, 3, Jalan PJS 11/15, 47500 Petaling Jaya', pageSize: 20, openNow: false, rankPreference: 'RELEVANCE' });
  expect(requests[1]).toEqual({ ...requests[0], pageToken: 'second' });
  expect(requests[2]).toEqual({ ...requests[0], pageToken: 'third' });
  expect(fetchMock.mock.calls.every((call) => call[0].endsWith('places:searchText'))).toBe(true);
  expect(fetchMock.mock.calls[0][1].headers['X-Goog-FieldMask']).toContain('nextPageToken');
});

it('does not treat a mismatched mall identity as address evidence or start scoped discovery', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('first')] }));
  expect(await fetchNearbyGoogleRestaurants({ ...mallOptions, mallPlaceId: 'other' })).toEqual([]);
  expect(fetchMock.mock.calls[0][0]).toContain('places:searchNearby');
});

it('stops paging when cancelled or budget reservation fails and never returns unscoped results', async () => {
  const controller = new AbortController();
  fetchMock.mockImplementationOnce(async () => { controller.abort(); return Response.json({ places: [tenantPlace('first')], nextPageToken: 'second' }); });
  await expect(searchPlacesByText({ ...mallOptions, textQuery: 'noodles', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.clearAllMocks();
  vi.mocked(reservePlacesCall).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('budget exhausted'));
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('first')], nextPageToken: 'second' }));
  await expect(searchPlacesByText({ ...mallOptions, textQuery: 'noodles' })).rejects.toThrow('budget exhausted');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('breaks repeated pagination tokens and retains normal single-request around search', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('first')], nextPageToken: 'repeat' }));
  fetchMock.mockResolvedValueOnce(Response.json({ places: [tenantPlace('second')], nextPageToken: 'repeat' }));
  expect(await searchPlacesByText({ ...mallOptions, textQuery: 'coffee' })).toHaveLength(2);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('rehydrates a saved mall without a session token or extending its original coordinate age', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ displayName: { text: 'Sunway Pyramid' }, formattedAddress: mallIdentity.address, types: ['shopping_mall'] }));
  const saved = { placeId: 'pyramid', mallPlaceId: 'pyramid', label: 'Saved destination', address: '', coordinates: mallOptions.location, fetchedAt: 123, scope: 'around' as const };
  expect(await refreshMallDestination(saved, new AbortController().signal)).toEqual({ ...saved, label: 'Sunway Pyramid', address: mallIdentity.address });
  expect(fetchMock.mock.calls[0][0]).not.toContain('sessionToken');
  expect(fetchMock.mock.calls[0][1].headers['X-Goog-FieldMask']).toBe('displayName,formattedAddress,types');
});
