import assert from 'node:assert/strict';

import type { Restaurant } from '@/types';
import { __resetFilterCacheForTests, enhancedFilterRestaurants } from '../src/lib/restaurantUtils';

const baseRestaurant: Restaurant = {
  id: 'r-1',
  name: 'Test Restaurant',
  category: ['malay'],
  address: '123 Test St',
  coordinates: { lat: 3.139, lng: 101.6869 },
  hours: {},
  rating: 4.5,
  userRatingCount: 20,
  priceRange: '$$',
  hasKnownPriceRange: true,
};

const run = () => {
  __resetFilterCacheForTests();

  const first = enhancedFilterRestaurants([], null, ['malay'], 'walk', ['$$'], 'all');
  assert.equal(first.results.length, 0, 'first empty pool call should return empty results');

  const second = enhancedFilterRestaurants([baseRestaurant], null, ['malay'], 'walk', ['$$'], 'all');
  assert.equal(second.results.length, 1, 'second populated pool call should not reuse empty cache result');
  assert.equal(second.results[0]?.id, baseRestaurant.id, 'second call should include the matching restaurant');
};

run();
console.log('restaurantUtils cache sequence test passed');
