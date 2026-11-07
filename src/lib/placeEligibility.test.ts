import { expect, it } from 'vitest';
import { classifyDiningPlace, isDiningVenueKind } from './placeEligibility';
import { normalizeGooglePlace } from './googlePlacesRestaurants';

it('classifies restaurants and supported food-service venues separately from cuisine', () => {
  for (const [type, expected] of [
    ['restaurant', 'restaurant'], ['japanese_restaurant', 'restaurant'], ['steak_house', 'restaurant'],
    ['cafe', 'cafe'], ['bakery', 'bakery'], ['ice_cream_shop', 'dessert'],
    ['dessert_restaurant', 'dessert'], ['food_court', 'food-court'], ['meal_takeaway', 'takeaway'], ['juice_shop', 'drinks'],
  ]) {
    expect(classifyDiningPlace({ primaryType: type })).toBe(expected);
    expect(classifyDiningPlace({ types: [type, 'food', 'point_of_interest'] })).toBe(expected);
  }
});

it('rejects retail, services and unknown places even with restaurant names or incidental food tags', () => {
  for (const primaryType of ['clothing_store', 'electronics_store', 'beauty_salon', 'bank', 'shopping_mall', 'supermarket', 'chocolate_factory', 'internet_cafe', 'bar']) {
    expect(classifyDiningPlace({ primaryType, types: ['restaurant', 'food'] })).toBe('non-dining');
  }
  for (const types of [undefined, [], ['food', 'point_of_interest', 'establishment'], ['store'], ['clothing_store']]) {
    expect(classifyDiningPlace({ types })).toBe('unknown');
  }
  expect(isDiningVenueKind('non-dining')).toBe(false);
  expect(isDiningVenueKind(undefined)).toBe(false);
});

it('normalization requires positive food-service identity before running cuisine heuristics', () => {
  const base = { id: 'tenant', displayName: { text: 'Sushi Coffee Noodles' }, formattedAddress: 'LG1.110, Sunway Pyramid',
    location: { latitude: 3.073, longitude: 101.607 }, containingPlaces: [{ id: 'pyramid' }] };
  const location = { lat: 3.073, lng: 101.607 };
  expect(normalizeGooglePlace({ ...base, primaryType: 'clothing_store', types: ['restaurant'] }, location, 'test')).toBeNull();
  expect(normalizeGooglePlace({ ...base, types: ['food'] }, location, 'test')).toBeNull();
  expect(normalizeGooglePlace({ ...base, types: ['restaurant'] }, location, 'test')).toMatchObject({ venueKind: 'restaurant' });
  expect(normalizeGooglePlace({ ...base, primaryType: 'cafe', types: ['cafe', 'store', 'food'] }, location, 'test')).toMatchObject({ venueKind: 'cafe' });
});
