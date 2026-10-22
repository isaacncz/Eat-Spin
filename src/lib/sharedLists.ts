import type { ManualList, ManualListMealTime, Restaurant } from '@/types';
export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_SHARED_PLACES = 100;
export interface SharedListSnapshot {
  version: 1;
  name: string;
  mealTime: ManualListMealTime;
  places: string[];
  createdAt: number;
  expiresAt: number;
}
export function buildSharedList(list: Pick<ManualList, 'name' | 'mealTime' | 'restaurants'>, now = Date.now()): SharedListSnapshot {
  const snapshot = {
    version: 1, name: list.name, mealTime: list.mealTime,
    places: list.restaurants.map((place) => place.name),
    createdAt: now, expiresAt: now + SHARE_TTL_MS,
  };
  return parseSharedList(snapshot, now);
}
export function parseSharedList(value: unknown, now = Date.now()): SharedListSnapshot {
  if (!value || typeof value !== 'object') throw new Error('This shared list is invalid.');
  const data = value as Record<string, unknown>;
  const mealTime = data.mealTime === 'any' ? null : data.mealTime;
  if (data.version !== 1 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 80
    || ![null, 'breakfast', 'lunch', 'dinner'].includes(mealTime as ManualListMealTime)
    || typeof data.createdAt !== 'number' || !Number.isFinite(data.createdAt)
    || typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt)
    || data.expiresAt <= now || data.expiresAt <= data.createdAt
    || data.expiresAt - data.createdAt > 30 * 86400000
    || !Array.isArray(data.places) || data.places.length < 1 || data.places.length > MAX_SHARED_PLACES
    || !data.places.every((name) => typeof name === 'string' && name.trim().length > 0 && name.length <= 120)) {
    throw new Error('This shared list is invalid or expired (maximum 100 places).');
  }
  return { version: 1, name: data.name.trim(), mealTime: mealTime as ManualListMealTime,
    places: data.places.map((name: string) => name.trim()), createdAt: data.createdAt, expiresAt: data.expiresAt };
}
export function sharedRestaurants(snapshot: SharedListSnapshot, newId: () => string): Restaurant[] {
  return snapshot.places.map((name) => ({
    id: `manual-${newId()}`, name, category: ['street food'],
    address: 'Your custom pick', coordinates: { lat: 0, lng: 0 },
    hours: {}, rating: 0, priceRange: '$$', description: 'Added by you.',
  }));
}
export function isSharedListId(id: string): boolean { return /^[a-f0-9]{32}$/.test(id); }
