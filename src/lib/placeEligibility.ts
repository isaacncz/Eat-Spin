import type { DiningVenueKind } from '@/types';

/** Explicit food-service types; generic `food` and shop names are not evidence.
 * Google taxonomy: https://developers.google.com/maps/documentation/places/web-service/place-types
 */
const DINING_TYPES: Readonly<Record<string, DiningVenueKind>> = {
  restaurant: 'restaurant', steak_house: 'restaurant', diner: 'restaurant',
  bistro: 'restaurant', bar_and_grill: 'restaurant', noodle_shop: 'restaurant',
  kebab_shop: 'restaurant', sandwich_shop: 'restaurant', hot_dog_stand: 'restaurant',
  cafe: 'cafe', coffee_shop: 'cafe', coffee_stand: 'cafe', cafeteria: 'cafe',
  cat_cafe: 'cafe', dog_cafe: 'cafe',
  bakery: 'bakery', bagel_shop: 'bakery', pastry_shop: 'bakery',
  dessert_shop: 'dessert', ice_cream_shop: 'dessert', donut_shop: 'dessert', cake_shop: 'dessert',
  food_court: 'food-court', meal_takeaway: 'takeaway', meal_delivery: 'takeaway', pizza_delivery: 'takeaway',
  juice_shop: 'drinks', tea_house: 'drinks',
};
const kindForType = (type: string): DiningVenueKind | undefined =>
  type === 'dessert_restaurant' ? 'dessert' : type.endsWith('_restaurant') ? 'restaurant' : Object.hasOwn(DINING_TYPES, type) ? DINING_TYPES[type] : undefined;

export type PlaceClassification = DiningVenueKind | 'non-dining' | 'unknown';

/** A specific primary identity outranks incidental secondary types and name heuristics. */
export function classifyDiningPlace(place: { primaryType?: string; types?: string[] }): PlaceClassification {
  if (place.primaryType) return kindForType(place.primaryType) ?? 'non-dining';
  for (const type of place.types ?? []) {
    const kind = kindForType(type);
    if (kind) return kind;
  }
  return 'unknown';
}

export function isDiningVenueKind(kind: string | undefined): kind is DiningVenueKind {
  return kind !== undefined && ['restaurant', 'cafe', 'bakery', 'dessert', 'food-court', 'takeaway', 'drinks'].includes(kind);
}
