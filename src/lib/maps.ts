import type { Restaurant } from '@/types';

/**
 * Google Maps link for a restaurant. Prefers the official URI from the Places API,
 * then a directions link from coordinates, then a plain search by name.
 */
export const getMapsUrl = (restaurant: Restaurant): string => {
  if (restaurant.googleMapsUri) return restaurant.googleMapsUri;

  const { lat, lng } = restaurant.coordinates;
  const query = encodeURIComponent(restaurant.name);
  return lat && lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${restaurant.googlePlaceId ?? ''}&query=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
};
