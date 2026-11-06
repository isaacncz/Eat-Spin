import { GROUP_ROOM_NAME_MAX_LENGTH } from '@/lib/groupRoomIdentity';
import type { Restaurant } from '@/types';

export const GROUP_ROOM_MAX_PLACES = 60;
/** Google place IDs use URL-safe characters; the room rules enforce the same pattern. */
export const GOOGLE_PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export interface RoomNearbyPlace {
  /** Name as shared with the room, truncated to the room's name limit. */
  name: string;
  placeId: string | null;
}

/** Collapses whitespace and shortens a name to the room limit, ending with an ellipsis when cut. */
export function toRoomPlaceName(value: string, max = GROUP_ROOM_NAME_MAX_LENGTH): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1).trimEnd()}…`;
}

/** Converts nearby results to unique room places, keeping valid Google place IDs. */
export function buildRoomNearbyPlaces(restaurants: Restaurant[], limit = GROUP_ROOM_MAX_PLACES): RoomNearbyPlace[] {
  const seen = new Set<string>();
  const places: RoomNearbyPlace[] = [];
  for (const restaurant of restaurants) {
    const name = toRoomPlaceName(restaurant.name);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const placeId = restaurant.googlePlaceId && GOOGLE_PLACE_ID_PATTERN.test(restaurant.googlePlaceId) ? restaurant.googlePlaceId : null;
    places.push({ name, placeId });
    if (places.length >= limit) break;
  }
  return places;
}

/** Name (lower-cased) → place ID map for the room list write. */
export const roomPlaceIdMap = (places: RoomNearbyPlace[]): Record<string, string> =>
  Object.fromEntries(places.filter(place => place.placeId).map(place => [place.name.toLowerCase(), place.placeId as string]));
