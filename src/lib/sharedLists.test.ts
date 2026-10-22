import { describe, expect, it } from 'vitest';
import { buildSharedList, isSharedListId, parseSharedList, sharedRestaurants, SHARE_TTL_MS } from './sharedLists';
import type { Restaurant } from '@/types';
const restaurant = { id: 'original', name: 'Noodles', photos: ['https://example.com?key=secret'], rating: 5 } as Restaurant;
const input = { name: 'Lunch', mealTime: 'lunch' as const, restaurants: [restaurant] };
describe('fixed list snapshots', () => {
  it('copies only list/place names and meal time, without personal data or keys', () => {
    const snapshot = buildSharedList(input, 1000);
    expect(snapshot.places).toEqual(['Noodles']);
    expect(JSON.stringify(snapshot)).not.toContain('secret');
    input.restaurants[0] = { ...restaurant, name: 'Edited later' };
    expect(snapshot.places).toEqual(['Noodles']);
  });
  it('validates expiry, version, item count and string lengths', () => {
    const snapshot = buildSharedList(input, 1000);
    expect(() => parseSharedList(snapshot, 1000 + SHARE_TTL_MS)).toThrow();
    expect(() => parseSharedList({ ...snapshot, version: 2 }, 1000)).toThrow();
    expect(() => parseSharedList({ ...snapshot, places: [] }, 1000)).toThrow();
    expect(() => parseSharedList({ ...snapshot, places: Array(101).fill('a') }, 1000)).toThrow();
    expect(() => parseSharedList({ ...snapshot, places: ['a'.repeat(121)] }, 1000)).toThrow();
  });
  it('creates independent local IDs for every import', () => {
    const snapshot = buildSharedList(input, 1000);
    const first = sharedRestaurants(snapshot, () => 'one');
    const second = sharedRestaurants(snapshot, () => 'two');
    expect(first[0].id).not.toBe(second[0].id);
    first[0].name = 'Local edit';
    expect(snapshot.places[0]).not.toBe('Local edit');
  });
  it('accepts only supported opaque link identifiers', () => {
    expect(isSharedListId('a'.repeat(32))).toBe(true);
    expect(isSharedListId('../rooms')).toBe(false);
  });
});
