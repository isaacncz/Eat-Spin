import { expect, it } from 'vitest';
import type { Restaurant } from '@/types';
import { filterMallRestaurants, matchesMallAddress } from './mallSearch';

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

const mall = { placeId: 'pyramid', label: 'Sunway Pyramid', address: '3, Jalan PJS 11/15, Bandar Sunway, 47500 Petaling Jaya, Selangor' };

it('matches tenant unit/floor addresses and a complete mall base address without a provider relationship', () => {
  for (const address of [
    'LG1.110, Sunway Pyramid Shopping Mall, 3, Jln PJS 11/15, 47500 Petaling Jaya',
    'Lot F1.86C, Floor 1, SUNWAY PYRAMID, Jalan PJS 11/15',
    'Lower Ground One, Sunway Pyramid',
    'Sunway Pyramid, 3, Jalan PJS 11/15, 47500 Petaling Jaya',
  ]) expect(matchesMallAddress(address, mall), address).toBe(true);
  expect(matchesMallAddress('LG1.110, Sunway Pyramid', { ...mall, label: 'Sunway Pyramid Mall' })).toBe(true);
  const restaurant = { id: 'address-tenant', source: 'google-live', address: 'LG1.110, Sunway Pyramid' } as Restaurant;
  expect(filterMallRestaurants([restaurant], mall.placeId, mall)).toEqual([restaurant]);
  expect(filterMallRestaurants([restaurant], 'other', mall)).toEqual([]);
  expect(filterMallRestaurants([{ ...restaurant, containingPlaceIds: ['other'] }], mall.placeId, mall)).toEqual([]);
});

it('rejects vicinity mentions, adjacent buildings, shared roads, wrong postcodes and missing identity', () => {
  for (const address of [
    'Near Sunway Pyramid, Lot 3, Jalan PJS 11/15, 47500',
    'LG1.110, Sunway Pyramid Hotel, 3, Jalan PJS 11/15, 47500',
    'Unit 3, Sunway Pyramid Annex, Jalan PJS 11/15, 47500',
    'Sunway Pyramid area, 47500 Petaling Jaya',
    'No 3, Jalan PJS 11/15, 47500 Petaling Jaya',
    'Unit LG1.110, Sunway Pyramid, Jalan PJS 11/15, 50000 Kuala Lumpur',
    'LG1.110, Sunway Pyramid Square, 47500',
    'LG1.110, Other mall, 47500',
    '',
  ]) expect(matchesMallAddress(address, mall), address).toBe(false);
  expect(matchesMallAddress('LG1.110, Sunway Pyramid', { ...mall, address: '' })).toBe(false);
});
