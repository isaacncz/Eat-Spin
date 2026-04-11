import type { Restaurant } from '@/types';

/**
 * Serves-filter IDs correspond to boolean fields on the Restaurant type
 * that come from the Google Places API "serves*" and service fields.
 */
export type ServesFilterId =
  | 'servesCoffee'
  | 'servesBreakfast'
  | 'servesBrunch'
  | 'servesDessert'
  | 'servesVegetarianFood'
  | 'delivery'
  | 'takeout';

export interface ServesFilterConfig {
  id: ServesFilterId;
  label: string;
  emoji: string;
}

export const SERVES_FILTERS: ServesFilterConfig[] = [
  { id: 'servesCoffee', label: 'Coffee', emoji: '☕' },
  { id: 'servesBreakfast', label: 'Breakfast', emoji: '🍳' },
  { id: 'servesBrunch', label: 'Brunch', emoji: '🥞' },
  { id: 'servesDessert', label: 'Dessert', emoji: '🍰' },
  { id: 'servesVegetarianFood', label: 'Vegetarian', emoji: '🥗' },
  { id: 'delivery', label: 'Delivery', emoji: '🛵' },
  { id: 'takeout', label: 'Takeout', emoji: '📦' },
];

/**
 * Filter restaurants by active serves-filter pills.
 * A restaurant must satisfy ALL active filters (AND logic).
 */
export function applyServesFilters(
  restaurants: Restaurant[],
  activeFilters: ServesFilterId[],
): Restaurant[] {
  if (activeFilters.length === 0) return restaurants;

  return restaurants.filter((r) =>
    activeFilters.every((filterId) => r[filterId] === true),
  );
}
