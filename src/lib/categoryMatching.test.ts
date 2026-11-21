import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/placesUsage', () => ({ reservePlacesCall: vi.fn().mockResolvedValue(undefined) }));
import { reservePlacesCall } from '@/lib/placesUsage';
import type { Restaurant } from '@/types';
import { detectSearchIntent } from './searchIntent';
import { categoryMatchRank, rankByCategoryMatch } from './categoryEvidence';
import { classifyPlace, enrichRestaurantCategories } from './categoryClassifier';
import { buildNearbyTypeRestriction, fetchNearbyGoogleRestaurants, normalizeGooglePlace, type GooglePlace } from './googlePlacesRestaurants';
import { searchCravingPlaces } from './cravingSearch';
import { __resetFilterCacheForTests, enhancedFilterRestaurants } from './restaurantUtils';

const origin = { lat: 3.07, lng: 101.6 };
const place = (id: string, primaryType: string, extra: Partial<GooglePlace> = {}): GooglePlace => ({
  id, primaryType, types: [primaryType, 'restaurant', 'food'], displayName: { text: id },
  location: { latitude: origin.lat, longitude: origin.lng }, rating: 4.5, userRatingCount: 200, ...extra,
});
const normalize = (value: GooglePlace) => normalizeGooglePlace(value, origin, 'test')!;

const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test'); vi.stubGlobal('fetch', fetchMock); __resetFilterCacheForTests(); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const requestBody = (call: number) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe('search intent', () => {
  it.each([
    ['coffee', 'cafe', 'cafe'], ['Good coffee near me', 'cafe', 'cafe'], ['kopi', 'cafe', 'cafe'], ['kedai kopi', 'cafe', 'cafe'],
    ['Café', 'cafe', 'cafe'], ['bakery', 'bakery', 'bakery'], ['ice cream', 'dessert', 'ice_cream_shop'],
    ['dessert bar', 'dessert', 'dessert_shop'], ['sushi', 'japanese', 'sushi_restaurant'], ['steamboat', 'hotpot', 'hot_pot_restaurant'],
    ['vegan food', 'vegetarian', 'vegan_restaurant'], ['dim sum', 'chinese', 'dim_sum_restaurant'],
  ])('%s → %s (%s)', (query, category, includedType) => {
    expect(detectSearchIntent(query)).toMatchObject({ category, includedType });
  });

  it('has no Google type for bubble tea but still knows the category', () => {
    expect(detectSearchIntent('boba')).toMatchObject({ category: 'bubble-tea' });
    expect(detectSearchIntent('boba')?.includedType).toBeUndefined();
  });

  it.each(['chicken rice', 'nasi lemak', 'laksa', 'coffee bean jelly', 'Starbucks', 'restaurant', ''])('treats %j as a dish or name search', (query) => {
    expect(detectSearchIntent(query)).toBeNull();
  });
});

describe('name patterns', () => {
  it.each([
    ['Carrot Cake Stall', 'dessert'], ['Roti Canai Corner', 'bakery'], ['Wing Heong Restaurant', 'chicken'],
    ['Koi Japanese Dining', 'bubble-tea'], ['Carlo Trattoria', 'fast-food'], ['Sunrise Brunch Club', 'cafe'],
    ['Startup Kitchen', 'dessert'], ['Matcha House', 'japanese'],
  ])('%s is not %s', (name, category) => {
    expect(classifyPlace({ displayName: name })).not.toContain(category);
  });

  it.each([
    ['Kopi & Co', 'cafe'], ['The Cake Shop', 'dessert'], ['Roti Boy', 'bakery'], ['Hong Kong Egg Tart', 'dessert'],
    ['KOI Thé', 'bubble-tea'], ['Kenny Rogers Chicken Wings', 'chicken'], ['Sweets Corner', 'dessert'],
  ])('%s is %s', (name, category) => {
    expect(classifyPlace({ displayName: name })).toContain(category);
  });
});

describe('category evidence', () => {
  it('ranks a primary-type café above a restaurant that only lists cafe as a secondary type', () => {
    const cafe = normalize(place('Brew Lab', 'cafe'));
    const restaurant = normalize(place('Golden Dragon', 'chinese_restaurant', { types: ['chinese_restaurant', 'cafe', 'restaurant'], servesCoffee: true }));
    const named = normalize(place('Uncle Kopi', 'restaurant'));
    expect(cafe.categoryEvidence?.cafe).toBe('strong');
    expect(named.categoryEvidence?.cafe).toBe('medium');
    expect(restaurant.categoryEvidence).toMatchObject({ chinese: 'strong', cafe: 'weak' });
    expect(restaurant.category).toContain('cafe');
    expect(categoryMatchRank(restaurant, ['cafe'])).toBe(1);
  });

  it('counts description words and serves flags as weak only', () => {
    const value = normalize(place('Hill Diner', 'restaurant', { editorialSummary: { text: 'Cosy spot for coffee and cakes' }, servesDessert: true }));
    expect(value.categoryEvidence).toMatchObject({ cafe: 'weak', dessert: 'weak' });
  });

  it('upgrades cached evidence from name heuristics without lowering it', () => {
    const cached = { ...normalize(place('Harbour Grill', 'seafood_restaurant')), name: 'Harbour Kopi', categoryEvidence: { seafood: 'strong' as const } };
    expect(enrichRestaurantCategories(cached).categoryEvidence).toEqual({ seafood: 'strong', cafe: 'medium' });
  });

  it('keeps legacy places without evidence on the old category + confidence rule', () => {
    const legacy = { id: 'x', category: ['cafe'], categoryConfidence: 'medium' } as unknown as Restaurant;
    expect(categoryMatchRank(legacy, ['cafe'])).toBe(2);
    expect(categoryMatchRank({ ...legacy, categoryConfidence: 'low' }, ['cafe'])).toBe(0);
    expect(categoryMatchRank({ ...legacy, categoryConfidence: 'low', source: 'local-fallback' }, ['cafe'])).toBe(2);
  });

  it('drops weak matches only when enough confident ones remain', () => {
    const strong = Array.from({ length: 5 }, (_, i) => normalize(place(`cafe-${i}`, 'cafe')));
    const weak = normalize(place('Golden Dragon', 'chinese_restaurant', { types: ['chinese_restaurant', 'cafe'] }));
    expect(rankByCategoryMatch([weak, ...strong], ['cafe'])).toEqual({ results: strong, broadened: false });
    expect(rankByCategoryMatch([weak, strong[0]], ['cafe'])).toEqual({ results: [strong[0], weak], broadened: true });
  });
});

describe('wheel filter', () => {
  const pool = (cafes: number) => [
    ...Array.from({ length: cafes }, (_, i) => normalize(place(`cafe-${i}`, 'cafe'))),
    normalize(place('Golden Dragon', 'chinese_restaurant', { types: ['chinese_restaurant', 'cafe'] })),
  ].map((r) => ({ ...r, hours: { daily: { windows: [{ open: '00:00', close: '23:59' }] } } }));

  it('shows confident matches only when there are enough', () => {
    const result = enhancedFilterRestaurants(pool(6), origin, ['cafe'], 5, [], 'all', 'v1', undefined, false);
    expect(result.results.map((r) => r.name)).not.toContain('Golden Dragon');
    expect(result.categoryBroadened).toBe(false);
  });

  it('adds weak matches after confident ones in a sparse area', () => {
    const result = enhancedFilterRestaurants(pool(2), origin, ['cafe'], 5, [], 'all', 'v2', undefined, false);
    expect(result.results.map((r) => r.name)).toEqual(['cafe-0', 'cafe-1', 'Golden Dragon']);
    expect(result.categoryBroadened).toBe(true);
  });
});

describe('Nearby type restriction', () => {
  it('uses primary types for typed categories and keeps the generic restaurant default', () => {
    expect(buildNearbyTypeRestriction()).toEqual({ includedTypes: ['restaurant'] });
    expect(buildNearbyTypeRestriction(['rice'])).toEqual({ includedTypes: ['restaurant'] });
    expect(buildNearbyTypeRestriction(['cafe'])).toEqual({ includedPrimaryTypes: ['cafe', 'coffee_shop', 'coffee_stand', 'coffee_roastery'] });
    expect(buildNearbyTypeRestriction(['cafe'], true)).toEqual({ includedTypes: ['cafe', 'coffee_shop', 'coffee_stand', 'coffee_roastery'] });
  });

  const options = { location: origin, radiusKm: 2, region: 'MY', language: 'en', selectedCategories: ['cafe' as const] };

  it('makes one wider any-type request when primary-type results are sparse, ranked as weak', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ places: [place('Brew Lab', 'cafe')] }));
    fetchMock.mockResolvedValueOnce(Response.json({ places: [place('Brew Lab', 'cafe'), place('Golden Dragon', 'chinese_restaurant', { types: ['chinese_restaurant', 'cafe'] })] }));
    const restaurants = await fetchNearbyGoogleRestaurants(options);
    expect(requestBody(0).includedPrimaryTypes).toContain('cafe');
    expect(requestBody(0).includedTypes).toBeUndefined();
    expect(requestBody(1).includedTypes).toContain('cafe');
    expect(reservePlacesCall).toHaveBeenCalledTimes(2);
    expect(restaurants.map((r) => [r.name, r.categoryEvidence?.cafe])).toEqual([['Brew Lab', 'strong'], ['Golden Dragon', 'weak']]);
  });

  it('skips the wider request when enough places match and keeps results if it fails', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ places: Array.from({ length: 5 }, (_, i) => place(`cafe-${i}`, 'cafe')) }));
    expect(await fetchNearbyGoogleRestaurants(options)).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    fetchMock.mockResolvedValueOnce(Response.json({ places: [place('Brew Lab', 'cafe')] }));
    vi.mocked(reservePlacesCall).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('budget exhausted'));
    expect((await fetchNearbyGoogleRestaurants(options)).map((r) => r.name)).toEqual(['Brew Lab']);
  });

  it('does not add a wider request for the generic restaurant search', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ places: [] }));
    await fetchNearbyGoogleRestaurants({ ...options, selectedCategories: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('craving search', () => {
  const textOptions = { location: origin, radiusKm: 2, openNowOnly: false };

  it('asks Google for the type strictly and ranks cafés first', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ places: [
      place('Golden Dragon', 'chinese_restaurant', { types: ['chinese_restaurant', 'cafe'] }),
      ...Array.from({ length: 5 }, (_, i) => place(`cafe-${i}`, 'cafe')),
    ] }));
    const result = await searchCravingPlaces({ ...textOptions, textQuery: 'coffee' });
    expect(requestBody(0)).toMatchObject({ textQuery: 'coffee', includedType: 'cafe', strictTypeFiltering: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.intent?.label).toBe('Cafés');
    expect(result.broadened).toBe(false);
    expect(result.restaurants.map((r) => r.name)).not.toContain('Golden Dragon');
  });

  it('fills a sparse typed result with one plain request ranked after it', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ places: [place('Brew Lab', 'cafe')] }));
    fetchMock.mockResolvedValueOnce(Response.json({ places: [place('Hill Diner', 'restaurant'), place('Brew Lab', 'cafe'), place('Kopi Corner', 'restaurant')] }));
    const result = await searchCravingPlaces({ ...textOptions, textQuery: 'coffee' });
    expect(requestBody(1).includedType).toBeUndefined();
    expect(requestBody(1).strictTypeFiltering).toBeUndefined();
    expect(result.restaurants.map((r) => r.name)).toEqual(['Brew Lab', 'Kopi Corner', 'Hill Diner']);
    expect(result.broadened).toBe(true);
  });

  it('keeps dish searches as one plain request in Google order', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ places: [place('B', 'restaurant'), place('A', 'chinese_restaurant')] }));
    const result = await searchCravingPlaces({ ...textOptions, textQuery: 'chicken rice' });
    expect(requestBody(0).includedType).toBeUndefined();
    expect(result).toMatchObject({ intent: null, broadened: false });
    expect(result.restaurants.map((r) => r.name)).toEqual(['B', 'A']);
  });
});
