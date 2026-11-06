import { expect, it } from 'vitest';
import type { Restaurant } from '@/types';
import { filterMallRestaurants } from './mallSearch';

it('accepts an exact containing mall ID, excludes unknown and other branches, and never trusts fallback data', () => {
  const restaurants = [
    { id: 'tenant', source: 'google-live', containingPlaceIds: ['pyramid'] },
    { id: 'other-branch', source: 'google-live', containingPlaceIds: ['other-mall'] },
    { id: 'unverified', source: 'google-live' },
    { id: 'nearby', source: 'google-cache', containingPlaceIds: [] },
    { id: 'fallback', source: 'local-fallback', containingPlaceIds: ['pyramid'] },
  ] as Restaurant[];
  expect(filterMallRestaurants(restaurants, 'pyramid').map((r) => r.id)).toEqual(['tenant']);
  expect(filterMallRestaurants(restaurants)).toBe(restaurants);
});
