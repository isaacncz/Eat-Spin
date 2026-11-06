import type { Restaurant } from '@/types';

export type SearchScope = 'inside' | 'around';

/** Candidate discovery area, never evidence that a restaurant belongs to a mall. */
export const MALL_DISCOVERY_RADIUS_KM = 2;

/** Missing relationships are unknown, not permission to include a nearby branch. */
export function filterMallRestaurants(restaurants: Restaurant[], mallPlaceId?: string): Restaurant[] {
  if (!mallPlaceId) return restaurants;
  return restaurants.filter((restaurant) =>
    restaurant.source !== 'local-fallback' &&
    restaurant.containingPlaceIds?.includes(mallPlaceId),
  );
}
